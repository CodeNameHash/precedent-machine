#!/usr/bin/env node
//
// Deal Terms release-package verifier.
//
// WHAT THIS FILE DOES (read the code, not this comment, if they ever disagree):
// it takes one argument, the root directory of a Deal Terms release package,
// and re-derives every hash and every content ID the package asserts about
// itself. It exits 0 only when nothing is missing, extra or altered.
//
// It makes NO network call, NO model call, and reads NOTHING outside the
// package directory it is given. The only imports are node:crypto, node:fs
// and node:path. A package ships a byte-identical copy of this file, so a
// consumer verifies offline with the Node runtime alone.
//
// The ID rule is the one in the producer's lib/canonical-v2/canonical-bytes.js
// (canonicalJson, sha256Hex, contentId). It is reproduced below because a
// package cannot import from the producer's repository. The reproduction is
// pinned by SELF_TEST_ID: if this copy ever drifts from the producer's module,
// the self-test fails before any package is read, and build-example.mjs
// additionally cross-checks this copy against the real module.
//
// Usage:  node verify.mjs <package-dir>
// Exit:   0 = every check passed. 1 = at least one check failed (all failures
//         are printed). 2 = the verifier could not run at all.

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';

/* ------------------------------------------------------------------ *
 * 1. The ID rule, reproduced from lib/canonical-v2/canonical-bytes.js *
 * ------------------------------------------------------------------ */

function canonicalize(value, seen) {
  if (value === null) return 'null';
  const type = typeof value;
  if (type === 'string' || type === 'boolean') return JSON.stringify(value);
  if (type === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('canonical JSON requires finite numbers');
    return JSON.stringify(value);
  }
  if (type !== 'object') throw new TypeError(`canonical JSON does not support ${type}`);
  if (seen.has(value)) throw new TypeError('canonical JSON does not support cyclic values');
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return `[${value.map((item) => canonicalize(item, seen)).join(',')}]`;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError('canonical JSON requires plain objects');
    }
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(value[key], seen)}`).join(',')}}`;
  } finally {
    seen.delete(value);
  }
}

export function canonicalJson(value) {
  return canonicalize(value, new Set());
}

function bytesOf(value) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  if (typeof value === 'string') return Buffer.from(value, 'utf8');
  throw new TypeError('hash input must be a string, Buffer or Uint8Array');
}

export function sha256Hex(value) {
  return createHash('sha256').update(bytesOf(value)).digest('hex');
}

export function contentId(domain, payload) {
  if (typeof domain !== 'string' || domain.length === 0) {
    throw new TypeError('content ID domain must be a non-empty string');
  }
  const domainBytes = Buffer.from(domain, 'utf8');
  const payloadBytes = Buffer.from(canonicalJson(payload), 'utf8');
  return sha256Hex(Buffer.concat([
    Buffer.from('CANONICAL_CONTENT_ID/V1\0', 'utf8'),
    Buffer.from(String(domainBytes.length), 'ascii'),
    Buffer.from(':', 'ascii'),
    domainBytes,
    Buffer.from('\0', 'utf8'),
    payloadBytes,
  ]));
}

export function utf8ByteLength(value) {
  return Buffer.byteLength(String(value), 'utf8');
}

// Pinned against the producer's module. Regenerating this value by running the
// copy below would defeat its purpose; it is produced by the real module.
const SELF_TEST_DOMAIN = 'DEAL_TERMS_CONTENT_ID_SELF_TEST/V1';
const SELF_TEST_PAYLOAD = { a: 1, b: ['x', null], c: { d: true } };
const SELF_TEST_ID = '1912733a0f811e525cf2d85ea4f08d7ff834f0aaf93b2b812653eb5fe570c965';

export function assertIdRuleSelfTest() {
  const computed = contentId(SELF_TEST_DOMAIN, SELF_TEST_PAYLOAD);
  if (computed !== SELF_TEST_ID) {
    throw new Error(
      `content ID rule self-test failed: expected ${SELF_TEST_ID}, computed ${computed}`,
    );
  }
  if (sha256Hex('') !== 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855') {
    throw new Error('SHA-256 self-test failed');
  }
}

/* ---------------------------------- *
 * 2. The closed vocabulary of v1      *
 * ---------------------------------- */

// Semantic version of the package contract. 1.0.0 was draft 1 (then spelled
// 'DEAL_TERMS_PACKAGE/V1'); 1.1.0 added transaction_id and the typed field
// quartet; 1.2.0 adds fact_state, source units, limitations, release lineage
// and the transaction-shaped corpus. A consumer refuses a major it does not
// implement.
export const PACKAGE_SCHEMA_VERSION = '1.2.0';
export const PACKAGE_SCHEMA_VERSION_RE = /^[0-9]+\.[0-9]+\.[0-9]+$/;

export const DOMAIN = Object.freeze({
  DEAL_KEY: 'DEAL_TERMS_DEAL_KEY/V1',
  CLAIM_REVISION: 'DEAL_TERMS_CLAIM_REVISION/V1',
  CATEGORY_SUMMARY: 'DEAL_TERMS_CATEGORY_SUMMARY/V1',
  DEAL_DOCUMENT: 'DEAL_TERMS_DEAL_DOCUMENT/V1',
  SOURCE_UNIT_SET: 'DEAL_TERMS_SOURCE_UNIT_SET/V1',
  CORPUS_MANIFEST: 'DEAL_TERMS_CORPUS_MANIFEST/V1',
  RELEASE_MANIFEST: 'DEAL_TERMS_RELEASE_MANIFEST/V1',
});

// Copied from evidence/canonical-v2/stage-2y-structure-migration/control/family-keys.json
// (STAGE_2Y_STRUCTURE_FAMILY_KEYS/V1, family_count 25).
export const FAMILY_KEYS = Object.freeze([
  'ANTITRUST_REGULATORY', 'APPRAISAL_DISSENTERS_RIGHTS', 'CAPITALISATION',
  'CLOSING_CONDITIONS', 'CONSIDERATION', 'DIVIDENDS', 'DNO_INDEMNIFICATION',
  'EMPLOYEE_MATTERS', 'FINANCING_COVENANTS', 'GENERAL_COVENANTS',
  'GUARANTY_FINANCING_PARTY', 'INTERIM_OPERATING', 'KEY_DEFINED_TERMS',
  'MAE_DEFINITION', 'MATERIAL_CONTRACTS', 'MERGER_STRUCTURE_CLOSING',
  'MISC_BOILERPLATE', 'NO_OTHER_REPS_FRAUD', 'NO_SHOP', 'PROXY_MEETING',
  'REPRESENTATIONS', 'SPECIFIC_PERFORMANCE_REMEDIES', 'TAX_MATTERS',
  'TERMINATION', 'TERMINATION_FEE',
]);

// Mirrors lib/canonical-v2/m7-v2-contract.js: the three-part state a rule
// carries, and validStateCombination(), which is the only legal pairing.
export const EXTRACTION_STATES = Object.freeze(['COMPLETE', 'INCOMPLETE', 'AMBIGUOUS']);
export const SOURCE_QUALITIES = Object.freeze(['SUFFICIENT', 'SOURCE_LIMITED', 'DRAFTING_AMBIGUOUS']);
export const REVIEW_STATES = Object.freeze([
  'NORMAL', 'APPROVED_LIMITED', 'REVIEW_ONLY', 'NO_COMPARISON', 'NO_OUTPUT',
]);

// FACT_VALUE_TYPES of lib/canonical-v2/m7-v2-contract.js (line 434 at the time
// of writing), and the typed_value shape each one requires, ported from that
// module's atomic-fact validation.
export const FACT_VALUE_TYPES = Object.freeze([
  'PARTY_SET', 'PARTY', 'ENUM', 'DEFINED_TERM', 'BOOLEAN', 'NUMBER',
  'PERCENTAGE', 'MONEY', 'DATE', 'DURATION', 'PERIOD', 'REFERENCE',
]);

const DURATION_UNITS = Object.freeze(['DAY', 'WEEK', 'MONTH', 'YEAR']);
const DURATION_BOUNDS = Object.freeze({
  DURATION: ['EXACT', 'WITHIN', 'AT_LEAST'],
  PERIOD: ['EXACT', 'WITHIN'],
});
// Sort-only day-equivalents. NOT date arithmetic: a month is not 30 days, and
// this constant must never be used to compute a deadline.
const DAYS_PER_UNIT = Object.freeze({ DAY: 1, WEEK: 7, MONTH: 30, YEAR: 365 });
const ISO_DATE_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

function isPlainValue(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

// Returns null when the typed value is well formed, or a message when it is not.
export function typedValueProblem(valueType, typedValue) {
  const keysAre = (value, keys) => isPlainValue(value)
    && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
  switch (valueType) {
    case 'PARTY_SET': {
      if (!keysAre(typedValue, ['parties'])) return 'PARTY_SET typed_value must be {parties}';
      const { parties } = typedValue;
      if (!Array.isArray(parties) || parties.length === 0) return 'party set is empty';
      if (!parties.every((party) => typeof party === 'string' && party.length > 0)) {
        return 'every party must be non-empty text';
      }
      if (new Set(parties).size !== parties.length) return 'party set repeats a party';
      return null;
    }
    case 'ENUM': case 'PARTY': case 'DEFINED_TERM': case 'DATE': case 'REFERENCE':
      return typeof typedValue === 'string' && typedValue.length > 0
        ? null : `${valueType} typed_value must be non-empty text`;
    case 'BOOLEAN':
      return typeof typedValue === 'boolean' ? null : 'BOOLEAN typed_value must be a boolean';
    case 'NUMBER': case 'PERCENTAGE':
      return typeof typedValue === 'number' && Number.isFinite(typedValue)
        ? null : `${valueType} typed_value must be a finite number`;
    case 'DURATION': case 'PERIOD': {
      if (!keysAre(typedValue, ['bound_type', 'count', 'unit'])) {
        return `${valueType} typed_value must be {bound_type, count, unit}`;
      }
      if (!DURATION_BOUNDS[valueType].includes(typedValue.bound_type)) {
        return `${valueType} bound_type is outside the closed vocabulary`;
      }
      if (!Number.isInteger(typedValue.count) || typedValue.count < 0) return 'count is invalid';
      if (!DURATION_UNITS.includes(typedValue.unit)) return 'unit is outside the closed vocabulary';
      return null;
    }
    case 'MONEY': {
      if (!keysAre(typedValue, ['amount', 'currency'])) {
        return 'MONEY typed_value must be {amount, currency}';
      }
      if (typeof typedValue.amount !== 'number' || !Number.isFinite(typedValue.amount)) {
        return 'money amount is invalid';
      }
      return typeof typedValue.currency === 'string' && typedValue.currency.length > 0
        ? null : 'money currency must be non-empty text';
    }
    default:
      return `unapproved value type ${valueType}`;
  }
}

// The unit a value type must carry, or null where it carries none.
export function unitFor(valueType, typedValue) {
  if (valueType === 'MONEY') return typedValue.currency;
  if (valueType === 'DURATION' || valueType === 'PERIOD') return typedValue.unit;
  if (valueType === 'PERCENTAGE') return 'PERCENT';
  return null;
}

// sort_value is derived deterministically from typed_value alone. Null means
// "this value type has no scalar order"; it never means "unknown".
export function sortValueFor(valueType, typedValue) {
  switch (valueType) {
    case 'NUMBER': case 'PERCENTAGE': return typedValue;
    case 'MONEY': return typedValue.amount;
    case 'BOOLEAN': return typedValue ? 1 : 0;
    case 'DATE': return ISO_DATE_RE.test(typedValue) ? typedValue : null;
    case 'DURATION': case 'PERIOD': return typedValue.count * DAYS_PER_UNIT[typedValue.unit];
    case 'ENUM': case 'PARTY': case 'DEFINED_TERM': case 'REFERENCE': return typedValue;
    case 'PARTY_SET': return null;
    default: return null;
  }
}

export function validStateCombination(extraction, quality, output) {
  return (extraction === 'COMPLETE' && quality === 'SUFFICIENT'
      && ['NORMAL', 'NO_COMPARISON', 'NO_OUTPUT'].includes(output))
    || (extraction === 'COMPLETE' && quality === 'SOURCE_LIMITED'
      && output === 'APPROVED_LIMITED')
    || (output === 'REVIEW_ONLY'
      && (extraction === 'INCOMPLETE' || extraction === 'AMBIGUOUS'
        || quality === 'DRAFTING_AMBIGUOUS'));
}

// Category rollup precedence, mirroring summariseOccurrenceStates():
// REVIEW_ONLY beats APPROVED_LIMITED beats NORMAL beats NO_COMPARISON.
// NO_OUTPUT claims are not summarised at all.
export function rollUpReviewState(states) {
  if (states.includes('REVIEW_ONLY')) return 'REVIEW_ONLY';
  if (states.includes('APPROVED_LIMITED')) return 'APPROVED_LIMITED';
  if (states.includes('NORMAL')) return 'NORMAL';
  return 'NO_COMPARISON';
}

// Q-0002 section 1, ruled in A-0006 section 1. A field's semantic state is
// distinct from its owning claim's review state: a resolved claim can carry a
// field that is genuinely absent from the clause, and "absent" must never be
// read as "zero" or "not extracted".
export const FACT_STATES = Object.freeze([
  'PRESENT', 'ABSENT', 'NOT_APPLICABLE', 'NOT_EXAMINED', 'FAILED',
]);

// The provenance kinds a context span may carry, from the re-plan's source
// closure: the parent chain up to SECTION, the governing chapeau, and the
// Article chapeau for representations.
export const CONTEXT_SPAN_KINDS = Object.freeze([
  'PARENT_CHAIN', 'GOVERNING_CHAPEAU', 'ARTICLE_CHAPEAU',
]);

export const CORPUS_KINDS = Object.freeze(['ONE_DEAL', 'FIVE_DEAL', 'SHARED_50_PROOF', 'PUBLIC']);
export const RELEASE_STATES = Object.freeze([
  'REVIEW_ONLY_INTERNAL', 'LEGAL_GATE_PASSED_INTERNAL', 'PUBLIC',
]);

export const HEX64_RE = /^[0-9a-f]{64}$/;
export const HEX40_RE = /^[0-9a-f]{40}$/;
export const CIK_RE = /^[0-9]{10}$/;
export const ACCESSION_RE = /^[0-9]{10}-[0-9]{2}-[0-9]{6}$/;
export const ROLE_KEY_RE = /^[A-Z][A-Z0-9_]{1,63}$/;
export const REASON_CODE_RE = /^[A-Z][A-Z0-9_]{2,63}$/;
export const PACKAGE_PATH_RE = /^(?:verify\.mjs|corpus\/corpus-manifest\.json|deals\/[0-9a-f]{64}\/deal\.json|source_units\/[0-9a-f]{64}\.json)$/;
export const CLASSIFICATION_LEVEL_RE = /^(?:APPLIES_TO|PROVISION_TYPE|SUB_PROVISION_TYPE|NESTED_SUBTYPE(?:_[0-9]+)?)$/;
export const COORDINATE_SYSTEM = 'UTF8_CANONICAL_TEXT_HALF_OPEN';

// Fields whose values are package-relative paths and are therefore exempt from
// the forbidden-path scan. Every other string in the package is scanned.
const PATH_FIELDS = new Set(['path', 'corpus_manifest_path', 'source_units_path']);

// The SEC document name is a filing-side document name, not a producer path.
// Q-0002 section 2 needs it to open the exact admitted document, so it is a
// deliberate, bounded exemption from the file-name scan and is validated
// positively by SEC_DOCUMENT_NAME_RE instead.
const SEC_LOCATOR_FIELDS = new Set(['sec_document_name']);
export const SEC_DOCUMENT_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

// The only identifiers that may be null, each for a reason the contract states.
// transaction_id: minted by the consumer and supplied through the corpus
// manifest, so a deal it has not keyed exports as null and cannot be PUBLIC.
// examined_source_unit_id: carried only by an ABSENT field.
// supersedes_release_manifest_id: null for the first release of a corpus.
const NULLABLE_ID_FIELDS = new Set([
  'transaction_id', 'examined_source_unit_id', 'supersedes_release_manifest_id',
]);

const FORBIDDEN_VALUE_PATTERNS = Object.freeze([
  [/(?:^|[\s"'(=])(?:\.{1,2}\/|~\/)/, 'relative filesystem path'],
  [/\/(?:home|root|Users|var|tmp|etc|opt)\//, 'absolute filesystem path'],
  [/(?:^|[\s"'(/])(?:lib|scripts|evidence|tests|pages|components|docs|contracts|supabase|sql|archive|node_modules|__fixtures__|fixtures)\//, 'producer repository path'],
  [/\.(?:js|mjs|cjs|ts|tsx|jsx|json|htm|html|sql|env|pem|key|deflate|log)(?:$|[\s"'),])/i, 'file name'],
  [/\b(?:postgres|postgresql|mysql|mongodb|redis):\/\//i, 'database connection string'],
  [/\b(?:supabase|service_role|api[_-]?key|access[_-]?token|bearer\s|authorization:|password)\b/i, 'credential'],
  [/\bsk-[A-Za-z0-9]{8,}|\beyJ[A-Za-z0-9_-]{10,}/, 'credential-shaped token'],
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i, 'UUID (mutable database identifier)'],
  [/\b(?:anthropic|openai|claude|gpt-[0-9]|sonnet|opus|haiku|gemini|llama|mistral)\b/i, 'model provider detail'],
  [/\bgit@|https?:\/\/github\.com\//i, 'source-control location'],
]);

// Exact field names only. Legitimate names that merely end in _path
// (classification_path, corpus_manifest_path) must not be caught here; the
// value scan and PACKAGE_PATH_RE handle real filesystem locators.
const FORBIDDEN_KEY_PATTERNS = Object.freeze([
  [/^(?:uuid|db_id|database_id|row_uuid|deal_uuid|supabase_id|table_name|column_name)$/i, 'database identifier'],
  [/^(?:file_path|absolute_path|repository_path|internal_path|source_path|dirname|filename|file_name)$/i, 'internal filesystem locator'],
  [/^(?:prompt|prompts|model|model_id|model_name|provider|temperature|top_p|api_key|secret|token|credential|credentials|password)$/i, 'model or credential detail'],
]);

/* ---------------------------------- *
 * 3. Failure collection               *
 * ---------------------------------- */

class Report {
  constructor() { this.failures = []; this.checks = 0; }

  check(condition, where, message) {
    this.checks += 1;
    if (!condition) this.failures.push(`${where}: ${message}`);
    return Boolean(condition);
  }

  equal(actual, expected, where, message) {
    return this.check(actual === expected, where, `${message} (expected ${expected}, found ${actual})`);
  }
}

function isPlain(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(report, value, keys, where) {
  if (!isPlain(value)) return report.check(false, where, 'must be a JSON object');
  const found = Object.keys(value).sort();
  const wanted = [...keys].sort();
  return report.check(
    canonicalJson(found) === canonicalJson(wanted),
    where,
    `keys do not match the closed contract (missing ${wanted.filter((k) => !found.includes(k)).join(',') || 'none'}; unexpected ${found.filter((k) => !wanted.includes(k)).join(',') || 'none'})`,
  );
}

function withoutKey(object, key) {
  const copy = { ...object };
  delete copy[key];
  return copy;
}

// A corrupted package must produce failures, never a crash. Every re-derivation
// goes through this, so a malformed record yields a mismatch line instead of a
// stack trace.
function safely(compute) {
  try {
    return compute();
  } catch (error) {
    return `<uncomputable: ${error.message}>`;
  }
}

/* ---------------------------------- *
 * 4. Filesystem walk                  *
 * ---------------------------------- */

function walk(root, relativeDir = '') {
  const absolute = relativeDir ? join(root, relativeDir) : root;
  const out = [];
  for (const entry of readdirSync(absolute, { withFileTypes: true }).sort(
    (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
  )) {
    const rel = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...walk(root, rel));
    else if (entry.isFile()) out.push(rel);
  }
  return out;
}

/* ---------------------------------- *
 * 5. Forbidden-content scan           *
 * ---------------------------------- */

function scanForbidden(report, value, where, keyName = null) {
  if (typeof value === 'string') {
    if (keyName !== null && (PATH_FIELDS.has(keyName) || SEC_LOCATOR_FIELDS.has(keyName))) return;
    for (const [pattern, label] of FORBIDDEN_VALUE_PATTERNS) {
      if (pattern.test(value)) {
        report.check(false, where, `forbidden content in a package (${label}): ${JSON.stringify(value.slice(0, 120))}`);
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanForbidden(report, item, `${where}[${index}]`, keyName));
    return;
  }
  if (isPlain(value)) {
    for (const key of Object.keys(value)) {
      if (!PATH_FIELDS.has(key) && !SEC_LOCATOR_FIELDS.has(key)) {
        for (const [pattern, label] of FORBIDDEN_KEY_PATTERNS) {
          if (pattern.test(key)) {
            report.check(false, `${where}.${key}`, `forbidden field name in a package (${label})`);
          }
        }
      }
      // Every key ending in _id must carry an immutable 64-hex content ID.
      // NULLABLE_ID_FIELDS is the closed set that may also be null, and each
      // one is null only for a documented reason the contract states.
      if (/_id$/.test(key)) {
        const permitted = typeof value[key] === 'string' && HEX64_RE.test(value[key])
          || (NULLABLE_ID_FIELDS.has(key) && value[key] === null);
        report.check(permitted, `${where}.${key}`,
          'every field ending in _id must be a 64-character lowercase hex content ID'
          + (NULLABLE_ID_FIELDS.has(key) ? ' or null' : ''));
      }
      scanForbidden(report, value[key], `${where}.${key}`, key);
    }
  }
}

/* ---------------------------------- *
 * 6. Per-record verification          *
 * ---------------------------------- */

const CLAIM_KEYS = [
  'claim_occurrence_id', 'claim_revision_id', 'family_key', 'claim_definition_key',
  'classification_levels', 'section_reference', 'state', 'reason_codes',
  'limitation', 'fields', 'source',
];
const CLAIM_BODY_KEYS = CLAIM_KEYS.filter((key) => key !== 'claim_revision_id');
const STATE_KEYS = ['extraction_state', 'source_quality', 'review_state'];
const FIELD_KEYS = [
  'field_key', 'label', 'fact_state', 'value_type', 'typed_value', 'unit', 'sort_value',
  'evidence_spans', 'examined_source_unit_id', 'reason_code',
  'rendered_value', 'rendered_value_digest', 'typed_value_digest',
];
const EVIDENCE_SPAN_KEYS = ['source_unit_id', 'start_byte', 'end_byte', 'text_sha256', 'excerpt_text'];
const LIMITATION_KEYS = ['code', 'text', 'ruling_id'];
const SOURCE_UNIT_KEYS = [
  'node_occurrence_id', 'heading_or_reference', 'document_order',
  'start_byte', 'end_byte', 'text_sha256', 'text', 'context_spans',
];
const CONTEXT_SPAN_KEYS = ['kind', 'node_occurrence_id', 'start_byte', 'end_byte', 'text_sha256', 'text'];
const SOURCE_UNIT_SET_KEYS = ['schema_version', 'source_unit_set_id', 'deal_key', 'units', 'counts'];
const SPAN_KEYS = ['node_occurrence_id', 'start_byte', 'end_byte', 'text_sha256', 'excerpt_text'];
const SOURCE_KEYS = ['node_occurrence_ids', 'coordinate_system', 'spans'];
const CATEGORY_KEYS = [
  'category_summary_id', 'family_key', 'classification_path',
  'claim_occurrence_ids', 'counts', 'summary_review_state',
];
const CATEGORY_BODY_KEYS = CATEGORY_KEYS.filter((key) => key !== 'category_summary_id');
const PROVENANCE_KEYS = [
  'agreement_id', 'canonical_text_id', 'canonical_text_sha256', 'canonical_text_byte_length',
  'coordinate_system', 'immutable_source_document_id', 'source_response_content_id',
  'source_admission_manifest_id', 'admission_receipt_id', 'raw_source_sha256',
  'raw_source_byte_length', 'retrieval_url_sha256',
  'sec_document_name', 'sec_document_sequence',
];
const DEAL_IDENTITY_KEYS = ['source_system', 'issuer_cik', 'accession', 'document_role_key'];
const DEAL_DOCUMENT_KEYS = [
  'schema_version', 'deal_document_id', 'deal_key', 'transaction_id', 'deal_identity',
  'provenance', 'source_unit_set_id', 'claims', 'category_summaries', 'counts',
];
const DEAL_DOCUMENT_BODY_KEYS = DEAL_DOCUMENT_KEYS.filter((key) => key !== 'deal_document_id');
// A document admission record. It sits under its transaction, never beside it:
// a transaction may carry several documents (Q-0002 section 5).
const CORPUS_DOCUMENT_KEYS = [
  'deal_key', 'source_system', 'issuer_cik', 'accession', 'document_role_key',
  'sec_document_name', 'sec_document_sequence', 'agreement_id', 'canonical_text_sha256',
  'source_admission_manifest_id', 'admission_receipt_id',
];
const CORPUS_TRANSACTION_KEYS = ['transaction_id', 'documents'];
const CORPUS_MANIFEST_KEYS = [
  'schema_version', 'corpus_manifest_id', 'corpus_id', 'corpus_kind',
  'selection_record_sha256', 'ben_approval_id', 'transactions', 'counts',
];
const CORPUS_MANIFEST_BODY_KEYS = CORPUS_MANIFEST_KEYS.filter((key) => key !== 'corpus_manifest_id');
const MANIFEST_KEYS = [
  'schema_version', 'package_schema_version', 'release_manifest_id', 'production_release_id',
  'supersedes_release_manifest_id', 'release_sequence', 'producer_commit', 'release_state',
  'public', 'released_at', 'corpus', 'deals', 'files', 'counts',
];
const MANIFEST_BODY_KEYS = MANIFEST_KEYS.filter((key) => key !== 'release_manifest_id');

// The closed key sets above, exported so build-example.mjs can prove that
// deal-terms-package.schema.json lists exactly the same required fields. A
// schema that drifts from the verifier is worse than no schema.
export const RECORD_KEYS = Object.freeze({
  claim: Object.freeze([...CLAIM_KEYS].sort()),
  state: Object.freeze([...STATE_KEYS].sort()),
  displayField: Object.freeze([...FIELD_KEYS].sort()),
  sourceSpan: Object.freeze([...SPAN_KEYS].sort()),
  claimSource: Object.freeze([...SOURCE_KEYS].sort()),
  categorySummary: Object.freeze([...CATEGORY_KEYS].sort()),
  provenance: Object.freeze([...PROVENANCE_KEYS].sort()),
  dealIdentity: Object.freeze([...DEAL_IDENTITY_KEYS].sort()),
  dealDocument: Object.freeze([...DEAL_DOCUMENT_KEYS].sort()),
  corpusDocument: Object.freeze([...CORPUS_DOCUMENT_KEYS].sort()),
  corpusTransaction: Object.freeze([...CORPUS_TRANSACTION_KEYS].sort()),
  evidenceSpan: Object.freeze([...EVIDENCE_SPAN_KEYS].sort()),
  limitation: Object.freeze([...LIMITATION_KEYS].sort()),
  sourceUnit: Object.freeze([...SOURCE_UNIT_KEYS].sort()),
  contextSpan: Object.freeze([...CONTEXT_SPAN_KEYS].sort()),
  sourceUnitSet: Object.freeze([...SOURCE_UNIT_SET_KEYS].sort()),
  corpusManifest: Object.freeze([...CORPUS_MANIFEST_KEYS].sort()),
  releaseManifest: Object.freeze([...MANIFEST_KEYS].sort()),
});

export function dealKeyOf(identity) {
  return contentId(DOMAIN.DEAL_KEY, {
    source_system: identity.source_system,
    issuer_cik: identity.issuer_cik,
    accession: identity.accession,
    document_role_key: identity.document_role_key,
  });
}

// There is deliberately no corpusIdOf(). A-0006 ruling 5: corpus_id is the
// content ID of Ben's approved transaction-selection record and is NEVER
// recomputed from the document keys in a package. Deriving it here would let a
// package mint a corpus identity for a selection nobody approved.

// One half-open UTF-8 byte span whose quoted text is bound to both its width
// and its SHA-256. Used for source-unit extents, context spans and per-field
// evidence spans alike, so the byte rule is stated once.
function verifySpanText(report, span, at) {
  report.check(Number.isInteger(span.start_byte) && span.start_byte >= 0,
    `${at}.start_byte`, 'must be a non-negative integer');
  report.check(Number.isInteger(span.end_byte) && span.end_byte > span.start_byte,
    `${at}.end_byte`, 'must exceed start_byte (half-open)');
  const text = span.text !== undefined ? span.text : span.excerpt_text;
  report.equal(safely(() => utf8ByteLength(text)), span.end_byte - span.start_byte, at,
    'text UTF-8 byte length does not equal the span width');
  report.equal(safely(() => sha256Hex(String(text))), span.text_sha256, at,
    'text_sha256 does not match SHA-256 of the text');
}

// A deal's source-unit set: the full canonical text of every governed
// authored unit, with its context spans. Q-0002 section 2, A-0006 ruling 2.
function verifySourceUnitSet(report, set, dealKey, where) {
  if (!exactKeys(report, set, SOURCE_UNIT_SET_KEYS, where)) return new Map();
  report.equal(set.schema_version, 'DEAL_TERMS_SOURCE_UNIT_SET/V1', where, 'wrong schema version');
  report.equal(set.deal_key, dealKey, `${where}.deal_key`, 'source unit set names another deal');
  const units = Array.isArray(set.units) ? set.units : [];
  report.check(units.length > 0, `${where}.units`, 'a source unit set must not be empty');
  const byId = new Map();
  const orders = [];
  units.forEach((unit, index) => {
    const at = `${where}.units[${index}]`;
    if (!exactKeys(report, unit, SOURCE_UNIT_KEYS, at)) return;
    report.check(HEX64_RE.test(unit.node_occurrence_id), `${at}.node_occurrence_id`, 'must be 64-hex');
    report.check(typeof unit.heading_or_reference === 'string' && unit.heading_or_reference.length > 0,
      `${at}.heading_or_reference`, 'must be non-empty text');
    report.check(Number.isInteger(unit.document_order) && unit.document_order >= 0,
      `${at}.document_order`, 'must be a non-negative integer');
    verifySpanText(report, unit, at);
    report.check(!byId.has(unit.node_occurrence_id), at, 'duplicate node_occurrence_id in the set');
    byId.set(unit.node_occurrence_id, unit);
    orders.push(unit.document_order);
    const contexts = Array.isArray(unit.context_spans) ? unit.context_spans : [];
    report.check(Array.isArray(unit.context_spans), `${at}.context_spans`, 'must be an array');
    contexts.forEach((context, contextIndex) => {
      const contextAt = `${at}.context_spans[${contextIndex}]`;
      if (!exactKeys(report, context, CONTEXT_SPAN_KEYS, contextAt)) return;
      report.check(CONTEXT_SPAN_KINDS.includes(context.kind), `${contextAt}.kind`,
        'not a context provenance kind');
      report.check(HEX64_RE.test(context.node_occurrence_id), `${contextAt}.node_occurrence_id`,
        'must be 64-hex');
      verifySpanText(report, context, contextAt);
    });
  });
  report.check(canonicalJson(orders) === canonicalJson([...orders].sort((a, b) => a - b)),
    `${where}.units`, 'units must be ordered by document_order');
  report.check(new Set(orders).size === orders.length, `${where}.units`,
    'two units share a document_order');
  report.check(
    canonicalJson(set.counts) === canonicalJson({
      units: units.length,
      context_spans: units.reduce(
        (total, unit) => total + (Array.isArray(unit.context_spans) ? unit.context_spans.length : 0), 0,
      ),
    }),
    `${where}.counts`, 'counts do not match the units',
  );
  report.equal(
    safely(() => contentId(DOMAIN.SOURCE_UNIT_SET, withoutKey(set, 'source_unit_set_id'))),
    set.source_unit_set_id, `${where}.source_unit_set_id`,
    'does not match the content ID of the source unit set',
  );
  return byId;
}

function verifyClaim(report, claim, where, sourceUnits) {
  if (!exactKeys(report, claim, CLAIM_KEYS, where)) return;
  report.check(FAMILY_KEYS.includes(claim.family_key), `${where}.family_key`, 'not a registered family key');
  report.check(HEX64_RE.test(claim.claim_occurrence_id), `${where}.claim_occurrence_id`, 'must be 64-hex');
  report.check(
    typeof claim.claim_definition_key === 'string' && ROLE_KEY_RE.test(claim.claim_definition_key),
    `${where}.claim_definition_key`, 'must be an upper-snake key',
  );
  report.check(
    typeof claim.section_reference === 'string' && claim.section_reference.length > 0,
    `${where}.section_reference`, 'must be non-empty text',
  );

  if (exactKeys(report, claim.state, STATE_KEYS, `${where}.state`)) {
    const { extraction_state: e, source_quality: q, review_state: r } = claim.state;
    report.check(EXTRACTION_STATES.includes(e), `${where}.state.extraction_state`, 'not in the vocabulary');
    report.check(SOURCE_QUALITIES.includes(q), `${where}.state.source_quality`, 'not in the vocabulary');
    report.check(REVIEW_STATES.includes(r), `${where}.state.review_state`, 'not in the vocabulary');
    report.check(validStateCombination(e, q, r), `${where}.state`,
      `illegal state combination ${e}/${q}/${r}`);
    report.check(Array.isArray(claim.reason_codes), `${where}.reason_codes`, 'must be an array');
    if (Array.isArray(claim.reason_codes)) {
      claim.reason_codes.forEach((code, index) => report.check(
        typeof code === 'string' && REASON_CODE_RE.test(code),
        `${where}.reason_codes[${index}]`, 'must be an upper-snake reason code',
      ));
      if (r === 'REVIEW_ONLY') {
        report.check(claim.reason_codes.length > 0, `${where}.reason_codes`,
          'REVIEW_ONLY requires at least one reason code');
      }
      if (r === 'NORMAL') {
        report.check(claim.reason_codes.length === 0, `${where}.reason_codes`,
          'NORMAL must carry no reason code');
      }
    }
  }

  // Classification levels: APPLIES_TO first, then the profile classification path.
  report.check(Array.isArray(claim.classification_levels) && claim.classification_levels.length >= 2,
    `${where}.classification_levels`, 'must carry APPLIES_TO plus at least one provision level');
  if (Array.isArray(claim.classification_levels)) {
    claim.classification_levels.forEach((level, index) => {
      const at = `${where}.classification_levels[${index}]`;
      if (!exactKeys(report, level, ['level', 'value'], at)) return;
      report.check(CLASSIFICATION_LEVEL_RE.test(level.level), `${at}.level`, 'not a classification level');
      report.check(typeof level.value === 'string' && level.value.length > 0, `${at}.value`, 'must be non-empty');
      if (index === 0) report.equal(level.level, 'APPLIES_TO', at, 'level 0 must be APPLIES_TO');
      if (index === 1) report.equal(level.level, 'PROVISION_TYPE', at, 'level 1 must be PROVISION_TYPE');
    });
  }

  // Limitation: required on APPROVED_LIMITED, forbidden otherwise (A-0006 ruling 3).
  const isLimited = isPlain(claim.state) && claim.state.review_state === 'APPROVED_LIMITED';
  if (isLimited) {
    if (exactKeys(report, claim.limitation, LIMITATION_KEYS, `${where}.limitation`)) {
      report.check(typeof claim.limitation.code === 'string' && REASON_CODE_RE.test(claim.limitation.code),
        `${where}.limitation.code`, 'must be a governed upper-snake limitation code');
      report.check(typeof claim.limitation.text === 'string' && claim.limitation.text.length > 0,
        `${where}.limitation.text`, 'must carry the text from the ruling record');
      report.check(typeof claim.limitation.ruling_id === 'string' && HEX64_RE.test(claim.limitation.ruling_id),
        `${where}.limitation.ruling_id`, 'must be the 64-hex ID of the ruling record');
    }
  } else {
    report.check(claim.limitation === null, `${where}.limitation`,
      'only an APPROVED_LIMITED claim carries a limitation');
  }

  // Display fields. Each carries a semantic fact_state that is independent of
  // the owning claim's review state (A-0006 ruling 1).
  report.check(Array.isArray(claim.fields), `${where}.fields`, 'must be an array');
  if (Array.isArray(claim.fields)) {
    claim.fields.forEach((field, index) => {
      const at = `${where}.fields[${index}]`;
      if (!exactKeys(report, field, FIELD_KEYS, at)) return;
      report.check(typeof field.rendered_value === 'string', `${at}.rendered_value`, 'must be a string');
      report.equal(safely(() => sha256Hex(String(field.rendered_value))), field.rendered_value_digest, at,
        'rendered_value_digest does not match SHA-256 of rendered_value');
      if (!report.check(FACT_STATES.includes(field.fact_state), `${at}.fact_state`,
        'not in the fact-state vocabulary')) return;
      if (!report.check(FACT_VALUE_TYPES.includes(field.value_type), `${at}.value_type`,
        'not in the producer value-type vocabulary')) return;

      const present = field.fact_state === 'PRESENT';
      const spans = Array.isArray(field.evidence_spans) ? field.evidence_spans : [];
      report.check(Array.isArray(field.evidence_spans), `${at}.evidence_spans`, 'must be an array');

      if (present) {
        // PRESENT needs a value and evidence. Zero and false are values.
        report.check(field.typed_value !== null, `${at}.typed_value`,
          'PRESENT requires a non-null typed_value (zero and false are PRESENT)');
        report.check(spans.length > 0, `${at}.evidence_spans`,
          'PRESENT requires at least one evidence span');
        if (field.typed_value !== null) {
          const problem = safely(() => typedValueProblem(field.value_type, field.typed_value));
          if (!report.check(problem === null, `${at}.typed_value`, String(problem))) return;
          report.equal(safely(() => canonicalJson(unitFor(field.value_type, field.typed_value))),
            safely(() => canonicalJson(field.unit)), `${at}.unit`,
            'unit is not the unit this value type carries');
          report.equal(safely(() => canonicalJson(sortValueFor(field.value_type, field.typed_value))),
            safely(() => canonicalJson(field.sort_value)), `${at}.sort_value`,
            'sort_value is not the deterministic derivation from typed_value');
        }
      } else {
        // Every other state carries no value, no unit, no order and no evidence.
        report.check(field.typed_value === null, `${at}.typed_value`,
          `${field.fact_state} requires typed_value null`);
        report.check(field.unit === null, `${at}.unit`, `${field.fact_state} requires unit null`);
        report.check(field.sort_value === null, `${at}.sort_value`,
          `${field.fact_state} requires sort_value null`);
        report.check(spans.length === 0, `${at}.evidence_spans`,
          `${field.fact_state} carries no evidence span`);
      }

      // The digest stays re-derivable in every state, including null.
      report.equal(safely(() => sha256Hex(canonicalJson(field.typed_value))), field.typed_value_digest, at,
        'typed_value_digest does not match SHA-256 of canonicalJson(typed_value)');

      // ABSENT must say which unit was examined; that is what makes it a finding.
      if (field.fact_state === 'ABSENT') {
        report.check(typeof field.examined_source_unit_id === 'string'
          && HEX64_RE.test(field.examined_source_unit_id), `${at}.examined_source_unit_id`,
          'ABSENT requires the id of the source unit that was examined');
      } else {
        report.check(field.examined_source_unit_id === null, `${at}.examined_source_unit_id`,
          'only ABSENT carries an examined source unit');
      }
      if (typeof field.examined_source_unit_id === 'string') {
        report.check(sourceUnits.has(field.examined_source_unit_id), `${at}.examined_source_unit_id`,
          'references a source unit that is not in this deal\'s source unit set');
      }

      // NOT_APPLICABLE must carry a governed reason code.
      if (field.fact_state === 'NOT_APPLICABLE') {
        report.check(typeof field.reason_code === 'string' && REASON_CODE_RE.test(field.reason_code),
          `${at}.reason_code`, 'NOT_APPLICABLE requires a governed reason code');
      } else {
        report.check(field.reason_code === null, `${at}.reason_code`,
          'only NOT_APPLICABLE carries a reason code');
      }

      // FAILED is only legal under a REVIEW_ONLY claim that says why.
      if (field.fact_state === 'FAILED') {
        report.check(isPlain(claim.state) && claim.state.review_state === 'REVIEW_ONLY', at,
          'FAILED requires the owning claim to be REVIEW_ONLY');
        report.check(Array.isArray(claim.reason_codes) && claim.reason_codes.length > 0, at,
          'FAILED requires the owning claim to carry issue codes');
      }

      spans.forEach((span, spanIndex) => {
        const spanAt = `${at}.evidence_spans[${spanIndex}]`;
        if (!exactKeys(report, span, EVIDENCE_SPAN_KEYS, spanAt)) return;
        report.check(HEX64_RE.test(span.source_unit_id), `${spanAt}.source_unit_id`, 'must be 64-hex');
        report.check(sourceUnits.has(span.source_unit_id), `${spanAt}.source_unit_id`,
          'references a source unit that is not in this deal\'s source unit set');
        verifySpanText(report, span, spanAt);
      });
    });
  }

  // Source spans: half-open UTF-8 byte offsets, with the quoted text bound to
  // both its own SHA-256 and the span width in bytes.
  if (exactKeys(report, claim.source, SOURCE_KEYS, `${where}.source`)) {
    report.equal(claim.source.coordinate_system, COORDINATE_SYSTEM, `${where}.source`,
      'spans must use the producer coordinate system');
    report.check(Array.isArray(claim.source.spans) && claim.source.spans.length > 0,
      `${where}.source.spans`, 'a claim must carry at least one source span');
    const declared = Array.isArray(claim.source.node_occurrence_ids) ? claim.source.node_occurrence_ids : [];
    const seen = new Set();
    (claim.source.spans || []).forEach((span, index) => {
      const at = `${where}.source.spans[${index}]`;
      if (!exactKeys(report, span, SPAN_KEYS, at)) return;
      report.check(HEX64_RE.test(span.node_occurrence_id), `${at}.node_occurrence_id`, 'must be 64-hex');
      seen.add(span.node_occurrence_id);
      report.check(Number.isInteger(span.start_byte) && span.start_byte >= 0, `${at}.start_byte`, 'must be a non-negative integer');
      report.check(Number.isInteger(span.end_byte) && span.end_byte > span.start_byte, `${at}.end_byte`, 'must exceed start_byte (half-open)');
      report.equal(safely(() => utf8ByteLength(span.excerpt_text)), span.end_byte - span.start_byte, at,
        'excerpt_text UTF-8 byte length does not equal the span width');
      report.equal(safely(() => sha256Hex(String(span.excerpt_text))), span.text_sha256, at,
        'text_sha256 does not match SHA-256 of excerpt_text');
      report.check(declared.includes(span.node_occurrence_id), at,
        'span node_occurrence_id is not declared in source.node_occurrence_ids');
      report.check(sourceUnits.has(span.node_occurrence_id), at,
        'span references a source unit that is not in this deal\'s source unit set');
    });
    report.check(
      canonicalJson([...declared].sort()) === canonicalJson([...seen].sort()),
      `${where}.source.node_occurrence_ids`,
      'declared node occurrences do not equal the set used by the spans',
    );
  }

  // Revision identity: contentId over the claim record without its own ID.
  report.equal(
    safely(() => contentId(DOMAIN.CLAIM_REVISION, withoutKey(claim, 'claim_revision_id'))),
    claim.claim_revision_id,
    `${where}.claim_revision_id`,
    'does not match the content ID of the claim record',
  );
  void CLAIM_BODY_KEYS;
}

function verifyCategorySummary(report, summary, claimsByOccurrence, where) {
  if (!exactKeys(report, summary, CATEGORY_KEYS, where)) return null;
  report.check(FAMILY_KEYS.includes(summary.family_key), `${where}.family_key`, 'not a registered family key');
  report.check(Array.isArray(summary.classification_path) && summary.classification_path.length > 0,
    `${where}.classification_path`, 'must be a non-empty path');
  report.check(Array.isArray(summary.claim_occurrence_ids) && summary.claim_occurrence_ids.length > 0,
    `${where}.claim_occurrence_ids`, 'must reference at least one claim');
  const ids = Array.isArray(summary.claim_occurrence_ids) ? summary.claim_occurrence_ids : [];
  report.check(canonicalJson(ids) === canonicalJson([...ids].sort()), `${where}.claim_occurrence_ids`,
    'must be sorted');
  const states = [];
  for (const id of ids) {
    const claim = claimsByOccurrence.get(id);
    if (!report.check(Boolean(claim), `${where}.claim_occurrence_ids`, `references unknown claim ${id}`)) continue;
    states.push(claim.state.review_state);
    report.equal(claim.family_key, summary.family_key, where, `claim ${id} is in another family`);
    const path = claim.classification_levels.slice(1).map((level) => level.value);
    report.check(safely(() => canonicalJson(path)) === safely(() => canonicalJson(summary.classification_path)), where,
      `claim ${id} has a different classification path`);
    report.check(claim.state.review_state !== 'NO_OUTPUT', where,
      `claim ${id} is NO_OUTPUT and must not be summarised`);
  }
  const counts = {};
  for (const state of REVIEW_STATES) counts[state] = states.filter((value) => value === state).length;
  report.check(safely(() => canonicalJson(summary.counts)) === canonicalJson(counts), `${where}.counts`,
    `counts do not match the referenced claims (expected ${canonicalJson(counts)})`);
  report.equal(summary.summary_review_state, rollUpReviewState(states), `${where}.summary_review_state`,
    'roll-up does not follow the precedence rule');
  report.equal(
    safely(() => contentId(DOMAIN.CATEGORY_SUMMARY, withoutKey(summary, 'category_summary_id'))),
    summary.category_summary_id,
    `${where}.category_summary_id`,
    'does not match the content ID of the summary record',
  );
  void CATEGORY_BODY_KEYS;
  // Separator: family keys are upper-snake and the JSON half starts with '[',
  // so the first space is always the boundary.
  return `${summary.family_key} ${canonicalJson(summary.classification_path)}`;
}

function verifyDealDocument(report, document, where, sourceUnits) {
  if (!exactKeys(report, document, DEAL_DOCUMENT_KEYS, where)) return null;
  report.equal(document.schema_version, 'DEAL_TERMS_DEAL_DOCUMENT/V1', where, 'wrong schema version');

  report.check(
    document.transaction_id === null
      || (typeof document.transaction_id === 'string' && HEX64_RE.test(document.transaction_id)),
    `${where}.transaction_id`,
    'must be a 64-hex consumer-minted transaction ID or null; a package never mints one',
  );

  if (exactKeys(report, document.deal_identity, DEAL_IDENTITY_KEYS, `${where}.deal_identity`)) {
    report.equal(document.deal_identity.source_system, 'SEC_EDGAR', `${where}.deal_identity.source_system`,
      'only SEC EDGAR identity is defined at v1');
    report.check(CIK_RE.test(document.deal_identity.issuer_cik), `${where}.deal_identity.issuer_cik`,
      'must be a zero-padded 10-digit CIK');
    report.check(ACCESSION_RE.test(document.deal_identity.accession), `${where}.deal_identity.accession`,
      'must match NNNNNNNNNN-NN-NNNNNN');
    report.check(ROLE_KEY_RE.test(document.deal_identity.document_role_key), `${where}.deal_identity.document_role_key`,
      'must be an upper-snake role key');
    report.equal(safely(() => dealKeyOf(document.deal_identity)), document.deal_key, `${where}.deal_key`,
      'does not match the content ID of (source system, CIK, accession, document role)');
  }

  if (exactKeys(report, document.provenance, PROVENANCE_KEYS, `${where}.provenance`)) {
    for (const key of ['canonical_text_sha256', 'raw_source_sha256', 'retrieval_url_sha256']) {
      report.check(HEX64_RE.test(document.provenance[key]), `${where}.provenance.${key}`, 'must be 64-hex');
    }
    report.equal(document.provenance.coordinate_system, COORDINATE_SYSTEM, `${where}.provenance`,
      'wrong coordinate system');
    for (const key of ['canonical_text_byte_length', 'raw_source_byte_length']) {
      report.check(Number.isInteger(document.provenance[key]) && document.provenance[key] > 0,
        `${where}.provenance.${key}`, 'must be a positive integer');
    }
    // The document locator, from the admitted-source receipt. Null where the
    // receipt did not record it; a package with any null cannot be PUBLIC.
    report.check(document.provenance.sec_document_name === null
      || (typeof document.provenance.sec_document_name === 'string'
        && SEC_DOCUMENT_NAME_RE.test(document.provenance.sec_document_name)),
      `${where}.provenance.sec_document_name`,
      'must be a bounded SEC document name with no path separator, or null');
    report.check(document.provenance.sec_document_sequence === null
      || (Number.isInteger(document.provenance.sec_document_sequence)
        && document.provenance.sec_document_sequence >= 1),
      `${where}.provenance.sec_document_sequence`, 'must be a positive integer or null');
  }

  report.check(typeof document.source_unit_set_id === 'string'
    && HEX64_RE.test(document.source_unit_set_id), `${where}.source_unit_set_id`,
    'must be the 64-hex ID of this deal\'s source unit set');

  report.check(Array.isArray(document.claims) && document.claims.length > 0, `${where}.claims`,
    'a deal document must carry at least one claim');
  const claims = Array.isArray(document.claims) ? document.claims : [];
  const byOccurrence = new Map();
  claims.forEach((claim, index) => {
    verifyClaim(report, claim, `${where}.claims[${index}]`, sourceUnits);
    if (isPlain(claim) && typeof claim.claim_occurrence_id === 'string') {
      report.check(!byOccurrence.has(claim.claim_occurrence_id), `${where}.claims[${index}]`,
        'duplicate claim_occurrence_id: one package carries one revision per occurrence');
      byOccurrence.set(claim.claim_occurrence_id, claim);
    }
  });
  const occurrenceIds = claims.map((claim) => claim && claim.claim_occurrence_id);
  report.check(canonicalJson(occurrenceIds) === canonicalJson([...occurrenceIds].sort()),
    `${where}.claims`, 'claims must be ordered by claim_occurrence_id');

  const summaries = Array.isArray(document.category_summaries) ? document.category_summaries : [];
  report.check(Array.isArray(document.category_summaries), `${where}.category_summaries`, 'must be an array');
  const summarised = new Set();
  summaries.forEach((summary, index) => {
    const key = verifyCategorySummary(report, summary, byOccurrence, `${where}.category_summaries[${index}]`);
    if (key !== null) {
      report.check(!summarised.has(key), `${where}.category_summaries[${index}]`,
        'two summaries for the same category');
      summarised.add(key);
    }
  });
  // Coverage: every category with a summarisable claim has exactly one summary.
  const required = new Set();
  for (const claim of claims) {
    if (!isPlain(claim) || !isPlain(claim.state) || claim.state.review_state === 'NO_OUTPUT') continue;
    if (!Array.isArray(claim.classification_levels)) continue;
    required.add(`${claim.family_key} ${canonicalJson(claim.classification_levels.slice(1).map((l) => l.value))}`);
  }
  for (const key of required) {
    report.check(summarised.has(key), `${where}.category_summaries`,
      `no summary for category ${key}`);
  }

  const counts = {
    claims: claims.length,
    category_summaries: summaries.length,
    families: [...new Set(claims.map((claim) => claim && claim.family_key))].length,
    by_review_state: Object.fromEntries(REVIEW_STATES.map((state) => [
      state, claims.filter((claim) => isPlain(claim) && isPlain(claim.state) && claim.state.review_state === state).length,
    ])),
  };
  report.check(safely(() => canonicalJson(document.counts)) === canonicalJson(counts), `${where}.counts`,
    `counts do not match the document (expected ${canonicalJson(counts)})`);

  report.equal(
    safely(() => contentId(DOMAIN.DEAL_DOCUMENT, withoutKey(document, 'deal_document_id'))),
    document.deal_document_id,
    `${where}.deal_document_id`,
    'does not match the content ID of the deal document',
  );
  void DEAL_DOCUMENT_BODY_KEYS;
  return document;
}

function verifyCorpusManifest(report, corpus, dealDocuments, where) {
  if (!exactKeys(report, corpus, CORPUS_MANIFEST_KEYS, where)) return;
  report.equal(corpus.schema_version, 'DEAL_TERMS_CORPUS_MANIFEST/V1', where, 'wrong schema version');
  report.check(CORPUS_KINDS.includes(corpus.corpus_kind), `${where}.corpus_kind`, 'not a corpus kind');
  // corpus_id is Ben's approved selection record's content ID, carried, never
  // recomputed here (A-0006 ruling 5). The package cites the selection bytes
  // and the approval so the citation is checkable against the selection itself.
  report.check(HEX64_RE.test(corpus.corpus_id), `${where}.corpus_id`, 'must be 64-hex');
  report.check(HEX64_RE.test(corpus.selection_record_sha256), `${where}.selection_record_sha256`,
    'must be 64-hex');
  report.check(HEX64_RE.test(corpus.ben_approval_id), `${where}.ben_approval_id`, 'must be 64-hex');

  const transactions = Array.isArray(corpus.transactions) ? corpus.transactions : [];
  report.check(transactions.length > 0, `${where}.transactions`, 'a corpus manifest must have transactions');
  const seenDealKeys = [];
  const transactionIds = [];
  transactions.forEach((transaction, index) => {
    const at = `${where}.transactions[${index}]`;
    if (!exactKeys(report, transaction, CORPUS_TRANSACTION_KEYS, at)) return;
    report.check(transaction.transaction_id === null
      || (typeof transaction.transaction_id === 'string' && HEX64_RE.test(transaction.transaction_id)),
      `${at}.transaction_id`, 'must be a 64-hex consumer-minted transaction ID or null');
    transactionIds.push(transaction.transaction_id);
    const documents = Array.isArray(transaction.documents) ? transaction.documents : [];
    report.check(documents.length > 0, `${at}.documents`, 'a transaction must carry at least one document');
    documents.forEach((member, memberIndex) => {
      const memberAt = `${at}.documents[${memberIndex}]`;
      if (!exactKeys(report, member, CORPUS_DOCUMENT_KEYS, memberAt)) return;
      report.equal(member.source_system, 'SEC_EDGAR', `${memberAt}.source_system`,
        'only SEC EDGAR identity is defined at v1');
      report.check(CIK_RE.test(member.issuer_cik), `${memberAt}.issuer_cik`,
        'must be a zero-padded 10-digit CIK');
      report.check(ACCESSION_RE.test(member.accession), `${memberAt}.accession`,
        'must match NNNNNNNNNN-NN-NNNNNN');
      report.check(ROLE_KEY_RE.test(member.document_role_key), `${memberAt}.document_role_key`,
        'must be an upper-snake role key');
      report.equal(safely(() => dealKeyOf(member)), member.deal_key, memberAt,
        'deal_key does not match its four identity components');
      report.check(HEX64_RE.test(member.canonical_text_sha256), `${memberAt}.canonical_text_sha256`,
        'must be 64-hex');
      seenDealKeys.push(member.deal_key);
      const document = dealDocuments.get(member.deal_key);
      if (report.check(Boolean(document), memberAt, 'corpus document has no deal document in this package')) {
        report.equal(document.provenance.agreement_id, member.agreement_id, memberAt,
          'agreement_id disagrees with the deal document');
        report.equal(document.provenance.canonical_text_sha256, member.canonical_text_sha256, memberAt,
          'canonical_text_sha256 disagrees with the deal document');
        report.equal(document.provenance.source_admission_manifest_id,
          member.source_admission_manifest_id, memberAt,
          'source_admission_manifest_id disagrees with the deal document');
        report.equal(document.provenance.admission_receipt_id, member.admission_receipt_id, memberAt,
          'admission_receipt_id disagrees with the deal document');
        report.equal(document.provenance.sec_document_name, member.sec_document_name, memberAt,
          'sec_document_name disagrees with the deal document');
        report.equal(document.provenance.sec_document_sequence, member.sec_document_sequence, memberAt,
          'sec_document_sequence disagrees with the deal document');
        // The corpus manifest is the only route a transaction ID enters a
        // package, and a document inherits the transaction it sits under.
        report.equal(document.transaction_id, transaction.transaction_id, memberAt,
          'transaction_id disagrees with the transaction this document sits under');
      }
    });
    const dealKeys = documents.map((member) => member && member.deal_key);
    report.check(canonicalJson(dealKeys) === canonicalJson([...dealKeys].sort()), `${at}.documents`,
      'documents must be ordered by deal_key');
  });

  report.check(canonicalJson(transactionIds) === canonicalJson([...transactionIds].sort(
    (left, right) => (left === null ? 1 : right === null ? -1 : left < right ? -1 : left > right ? 1 : 0),
  )), `${where}.transactions`, 'transactions must be ordered by transaction_id, null last');
  const keyed = transactionIds.filter((value) => value !== null);
  report.check(new Set(keyed).size === keyed.length, `${where}.transactions`,
    'two transactions share a transaction_id');
  report.check(transactionIds.filter((value) => value === null).length <= 1, `${where}.transactions`,
    'at most one transaction group may be unkeyed');
  report.check(new Set(seenDealKeys).size === seenDealKeys.length, `${where}.transactions`,
    'a deal_key appears under more than one transaction');
  report.check(
    canonicalJson([...dealDocuments.keys()].sort()) === canonicalJson([...seenDealKeys].sort()),
    where, 'the corpus documents and the deal documents in the package are not the same set',
  );

  // The size bound counts unique transactions, not documents (A-0006 ruling 5).
  const transactionCount = transactions.length;
  const documentCount = seenDealKeys.length;
  report.check(
    canonicalJson(corpus.counts) === canonicalJson({
      transaction_count: transactionCount, document_count: documentCount,
    }),
    `${where}.counts`, 'counts do not match the transactions and documents',
  );
  if (corpus.corpus_kind === 'ONE_DEAL') {
    report.equal(transactionCount, 1, `${where}.transactions`,
      'a ONE_DEAL corpus has exactly one transaction');
  }
  if (corpus.corpus_kind === 'FIVE_DEAL') {
    report.equal(transactionCount, 5, `${where}.transactions`,
      'a FIVE_DEAL corpus has exactly five transactions');
  }
  if (corpus.corpus_kind === 'SHARED_50_PROOF') {
    report.equal(transactionCount, 50, `${where}.transactions`,
      'a SHARED_50_PROOF corpus has exactly fifty transactions');
  }
  report.equal(
    safely(() => contentId(DOMAIN.CORPUS_MANIFEST, withoutKey(corpus, 'corpus_manifest_id'))),
    corpus.corpus_manifest_id,
    `${where}.corpus_manifest_id`,
    'does not match the content ID of the corpus manifest',
  );
}

/* ---------------------------------- *
 * 7. The whole package                *
 * ---------------------------------- */

export function verifyPackage(packageDir) {
  const report = new Report();
  const root = resolve(packageDir);

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
  } catch (error) {
    report.check(false, 'manifest.json', `could not be read as JSON (${error.message})`);
    return report;
  }

  if (!exactKeys(report, manifest, MANIFEST_KEYS, 'manifest.json')) return report;
  report.equal(manifest.schema_version, 'DEAL_TERMS_RELEASE_MANIFEST/V1', 'manifest.json', 'wrong schema version');
  report.check(
    typeof manifest.package_schema_version === 'string'
      && PACKAGE_SCHEMA_VERSION_RE.test(manifest.package_schema_version),
    'manifest.json.package_schema_version', 'must be a semantic version, MAJOR.MINOR.PATCH',
  );
  report.equal(manifest.package_schema_version, PACKAGE_SCHEMA_VERSION, 'manifest.json',
    `this verifier implements ${PACKAGE_SCHEMA_VERSION} only`);
  report.check(HEX40_RE.test(manifest.producer_commit), 'manifest.json.producer_commit',
    'must be a 40-character lowercase git commit hash');
  report.check(RELEASE_STATES.includes(manifest.release_state), 'manifest.json.release_state', 'not a release state');
  // Release lineage (A-0006 ruling 4). Each package is a complete snapshot of
  // its corpus; the sequence orders releases and the predecessor names the
  // exact release a consumer rolls back to.
  report.check(Number.isInteger(manifest.release_sequence) && manifest.release_sequence >= 1,
    'manifest.json.release_sequence', 'must be an integer of at least 1');
  report.check(manifest.supersedes_release_manifest_id === null
    || (typeof manifest.supersedes_release_manifest_id === 'string'
      && HEX64_RE.test(manifest.supersedes_release_manifest_id)),
    'manifest.json.supersedes_release_manifest_id',
    'must be the 64-hex release_manifest_id of the predecessor, or null for the first release');
  report.equal(manifest.supersedes_release_manifest_id === null, manifest.release_sequence === 1,
    'manifest.json', 'release_sequence 1 and a null predecessor must agree: the first release of a corpus has both');
  report.check(manifest.supersedes_release_manifest_id !== manifest.release_manifest_id,
    'manifest.json.supersedes_release_manifest_id', 'a release cannot supersede itself');
  report.check(typeof manifest.public === 'boolean', 'manifest.json.public', 'must be a boolean');
  report.equal(manifest.public, manifest.release_state === 'PUBLIC', 'manifest.json',
    'public must be true if and only if release_state is PUBLIC');
  report.check(
    typeof manifest.released_at === 'string'
      && /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$/.test(manifest.released_at),
    'manifest.json.released_at', 'must be an RFC 3339 UTC instant with second precision',
  );

  // Manifest closure: the files on disk are exactly the files listed, with the
  // listed sizes and digests. manifest.json itself is never listed.
  const onDisk = walk(root).filter((path) => path !== 'manifest.json');
  const listed = Array.isArray(manifest.files) ? manifest.files : [];
  const listedPaths = listed.map((file) => (isPlain(file) ? file.path : null));
  report.check(canonicalJson(listedPaths) === canonicalJson([...listedPaths].sort()),
    'manifest.json.files', 'files must be ordered by path');
  report.check(canonicalJson([...onDisk].sort()) === canonicalJson([...listedPaths].sort()),
    'manifest.json.files',
    `manifest closure broken (on disk but unlisted: ${onDisk.filter((p) => !listedPaths.includes(p)).join(', ') || 'none'}; listed but missing: ${listedPaths.filter((p) => !onDisk.includes(p)).join(', ') || 'none'})`);
  listed.forEach((file, index) => {
    const at = `manifest.json.files[${index}]`;
    if (!exactKeys(report, file, ['path', 'sha256', 'byte_length'], at)) return;
    report.check(PACKAGE_PATH_RE.test(file.path), `${at}.path`, 'not a permitted package path');
    report.check(!file.path.includes('..') && !file.path.includes(sep === '/' ? '\\' : '/'),
      `${at}.path`, 'must be a forward-slash package-relative path with no traversal');
    let bytes;
    try {
      bytes = readFileSync(join(root, file.path));
    } catch (error) {
      report.check(false, at, `listed file could not be read (${error.message})`);
      return;
    }
    report.equal(sha256Hex(bytes), file.sha256, at, 'SHA-256 does not match the file bytes');
    report.equal(bytes.length, file.byte_length, at, 'byte_length does not match the file bytes');
  });
  report.check(listedPaths.includes('verify.mjs'), 'manifest.json.files',
    'a package must ship and list its own verify.mjs');

  // Deal documents, each with its source unit set loaded first: claims and
  // fields reference units by id, so the index has to exist before they verify.
  const dealDocuments = new Map();
  let sourceUnitTotal = 0;
  const deals = Array.isArray(manifest.deals) ? manifest.deals : [];
  deals.forEach((entry, index) => {
    const at = `manifest.json.deals[${index}]`;
    if (!exactKeys(report, entry, ['deal_key', 'deal_document_id', 'path', 'source_units_path'], at)) return;
    report.equal(entry.path, `deals/${entry.deal_key}/deal.json`, at,
      'a deal document lives at deals/<deal_key>/deal.json');
    report.equal(entry.source_units_path, `source_units/${entry.deal_key}.json`, at,
      'a source unit set lives at source_units/<deal_key>.json');

    let sourceUnits = new Map();
    let sourceUnitSet = null;
    try {
      sourceUnitSet = JSON.parse(readFileSync(join(root, entry.source_units_path), 'utf8'));
    } catch (error) {
      report.check(false, at, `source unit set could not be read as JSON (${error.message})`);
    }
    if (sourceUnitSet) {
      sourceUnits = verifySourceUnitSet(report, sourceUnitSet, entry.deal_key, entry.source_units_path);
      sourceUnitTotal += sourceUnits.size;
      scanForbidden(report, sourceUnitSet, entry.source_units_path);
    }

    let document;
    try {
      document = JSON.parse(readFileSync(join(root, entry.path), 'utf8'));
    } catch (error) {
      report.check(false, at, `deal document could not be read as JSON (${error.message})`);
      return;
    }
    const verified = verifyDealDocument(report, document, entry.path, sourceUnits);
    if (verified && sourceUnitSet) {
      report.equal(verified.source_unit_set_id, sourceUnitSet.source_unit_set_id, at,
        'source_unit_set_id disagrees with the source unit set');
    }
    if (verified) {
      report.equal(verified.deal_key, entry.deal_key, at, 'deal_key disagrees with the deal document');
      report.equal(verified.deal_document_id, entry.deal_document_id, at,
        'deal_document_id disagrees with the deal document');
      dealDocuments.set(verified.deal_key, verified);
      scanForbidden(report, verified, entry.path);
    }
  });
  const dealKeys = deals.map((entry) => entry && entry.deal_key);
  report.check(canonicalJson(dealKeys) === canonicalJson([...dealKeys].sort()), 'manifest.json.deals',
    'deals must be ordered by deal_key');

  // Corpus manifest.
  if (exactKeys(report, manifest.corpus, ['corpus_id', 'corpus_kind', 'corpus_manifest_id', 'corpus_manifest_path'],
    'manifest.json.corpus')) {
    report.equal(manifest.corpus.corpus_manifest_path, 'corpus/corpus-manifest.json', 'manifest.json.corpus',
      'the corpus manifest lives at corpus/corpus-manifest.json');
    let corpus;
    try {
      corpus = JSON.parse(readFileSync(join(root, manifest.corpus.corpus_manifest_path), 'utf8'));
    } catch (error) {
      report.check(false, 'manifest.json.corpus', `corpus manifest could not be read as JSON (${error.message})`);
      corpus = null;
    }
    if (corpus) {
      verifyCorpusManifest(report, corpus, dealDocuments, manifest.corpus.corpus_manifest_path);
      report.equal(corpus.corpus_id, manifest.corpus.corpus_id, 'manifest.json.corpus', 'corpus_id disagrees');
      report.equal(corpus.corpus_kind, manifest.corpus.corpus_kind, 'manifest.json.corpus', 'corpus_kind disagrees');
      report.equal(corpus.corpus_manifest_id, manifest.corpus.corpus_manifest_id, 'manifest.json.corpus',
        'corpus_manifest_id disagrees');
      scanForbidden(report, corpus, manifest.corpus.corpus_manifest_path);
    }
  }

  // A package may only be PUBLIC when every deal in it carries the consumer's
  // transaction ID. An unkeyed deal cannot be shown to users.
  if (manifest.release_state === 'PUBLIC') {
    for (const [dealKey, document] of dealDocuments) {
      report.check(document.transaction_id !== null, 'manifest.json.release_state',
        `deal ${dealKey} has transaction_id null and so this package cannot be PUBLIC`);
      report.check(document.provenance.sec_document_name !== null
        && document.provenance.sec_document_sequence !== null, 'manifest.json.release_state',
        `deal ${dealKey} has no SEC document locator and so this package cannot be PUBLIC`);
    }
  }

  const counts = {
    deals: deals.length,
    files: listed.length,
    claims: [...dealDocuments.values()].reduce((total, document) => total + document.claims.length, 0),
    category_summaries: [...dealDocuments.values()].reduce(
      (total, document) => total + document.category_summaries.length, 0,
    ),
    source_units: sourceUnitTotal,
  };
  report.check(safely(() => canonicalJson(manifest.counts)) === canonicalJson(counts), 'manifest.json.counts',
    `counts do not match the package (expected ${canonicalJson(counts)})`);

  scanForbidden(report, withoutKey(manifest, 'files'), 'manifest.json');
  (manifest.files || []).forEach((file, index) => scanForbidden(
    report, withoutKey(isPlain(file) ? file : {}, 'path'), `manifest.json.files[${index}]`,
  ));

  report.equal(
    safely(() => contentId(DOMAIN.RELEASE_MANIFEST, withoutKey(manifest, 'release_manifest_id'))),
    manifest.release_manifest_id,
    'manifest.json.release_manifest_id',
    'does not match the content ID of the release manifest',
  );
  void MANIFEST_BODY_KEYS;
  return report;
}

/* ---------------------------------- *
 * 8. CLI                              *
 * ---------------------------------- */

function main(argv) {
  try {
    assertIdRuleSelfTest();
  } catch (error) {
    process.stderr.write(`FAIL ${error.message}\n`);
    return 2;
  }
  const packageDir = argv[0];
  if (!packageDir) {
    process.stderr.write('usage: node verify.mjs <package-dir>\n');
    return 2;
  }
  try {
    if (!statSync(packageDir).isDirectory()) {
      process.stderr.write(`FAIL ${packageDir} is not a directory\n`);
      return 2;
    }
  } catch (error) {
    process.stderr.write(`FAIL ${packageDir} could not be opened (${error.message})\n`);
    return 2;
  }
  let report;
  try {
    report = verifyPackage(packageDir);
  } catch (error) {
    process.stderr.write(`FAIL verifier aborted: ${error.message}\n`);
    return 2;
  }
  if (report.failures.length === 0) {
    process.stdout.write(`PASS ${packageDir}: ${report.checks} checks, 0 failures\n`);
    return 0;
  }
  for (const failure of report.failures) process.stdout.write(`FAIL ${failure}\n`);
  process.stdout.write(`FAIL ${packageDir}: ${report.checks} checks, ${report.failures.length} failures\n`);
  return 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
