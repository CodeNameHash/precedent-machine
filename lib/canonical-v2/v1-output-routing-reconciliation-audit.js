'use strict';

// This module does not read V1 rows.  The repository has no complete static
// rendered V1 export.  It therefore defines the read-only acquisition contract
// that must be satisfied before any rendered-surface reconciliation can begin.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { canonicalJson, contentId, sha256Hex } = require('./canonical-bytes');

const SCHEMA = 'M3_V1_RENDERED_SURFACE_ACQUISITION_PLAN/V1';
const STATUS = 'STATIC_EVIDENCE_INCOMPLETE';
const V1_RENDER_SOURCE_CAPTURE_SCHEMA = 'V1_RENDER_SOURCE_CAPTURE/V1';
const V1_RENDER_REPLAY_SCHEMA = 'V1_RENDER_REPLAY/V1';
const V1_RENDER_LEDGER_SCHEMA = 'V1_RENDER_LEDGER/V1';
const V1_RENDER_COLLECTOR_AUTHORITY_SCHEMA = 'V1_RENDER_COLLECTOR_AUTHORITY/V1';
const V1_RENDER_EXECUTION_RECEIPT_SCHEMA = 'V1_RENDER_EXECUTION_RECEIPT/V1';
const TRUSTED_V1_CAPTURE_AND_REPLAY_EXECUTOR_NOT_IMPLEMENTED = 'TRUSTED_V1_CAPTURE_AND_REPLAY_EXECUTOR_NOT_IMPLEMENTED';
const REVIEW_ROOT = 'pages/review-v1/[id].js';
const ROSTER_SIZE = 40;
const DIRECT_RENDERER_DEPENDENCY_COUNT = 54;
const TABLE_CONFIG_COUNT = 19;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_RE = /^[a-f0-9]{64}$/;
const RENDER_SELECTOR_CONTRACT = Object.freeze([
  Object.freeze({ selector_id: 'DEAL_ROUTE', selector: '/review-v1/:deal_id', purpose: 'ONE_RENDER_PER_CAPTURED_DEAL' }),
  Object.freeze({ selector_id: 'CONFIG_SECTION', selector: '[data-testid^="provision-table-"]', purpose: 'COMPLETE_CONFIG_SECTION_CAPTURE' }),
  Object.freeze({ selector_id: 'CONFIG_RENDER_BODY', selector: '[data-testid^="provision-table-body-"]', purpose: 'CUSTOM_RENDER_BODY_CAPTURE' }),
  Object.freeze({ selector_id: 'DISPLAYED_CELL', selector: 'renderer-instrumentation:displayed-cell', purpose: 'DISPLAYED_VALUE_CAPTURE' }),
  Object.freeze({ selector_id: 'UNMOUNTED_DISPOSITION', selector: 'renderer-instrumentation:source-record-disposition', purpose: 'HIDDEN_AND_UNMOUNTED_PROOF' }),
]);
const REQUIRED_REVIEW_INPUTS = Object.freeze(['agreement_source', 'deals', 'provision_types', 'provisions', 'review_cards', 'review_cards_claims']);
const HIDDEN_UNMOUNTED_REASON_CODES = Object.freeze({
  HIDDEN: Object.freeze(['FILTERED_BY_RENDERER', 'SECTION_COLLAPSED']),
  UNMOUNTED: Object.freeze(['VIRTUALISED_OFFSCREEN', 'CONFIG_NOT_RENDERED']),
  DISPLAYED_AS_EMPTY: Object.freeze(['SOURCE_VALUE_EMPTY']),
});
const REFERENCE_EDGE_TYPES = Object.freeze(['SOURCE_RECORD_REFERENCE', 'CROSS_SECTION_REFERENCE']);

class V1OutputRoutingReconciliationAuditError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
function fail(code, message) { throw new V1OutputRoutingReconciliationAuditError(code, message); }
function isPlainObject(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function exactKeys(value, keys) { return isPlainObject(value) && sameArray(Object.keys(value).sort(), [...keys].sort()); }
function digest(value) { return contentId(SCHEMA, value); }
function sameArray(left, right) { return canonicalJson(left) === canonicalJson(right); }
function absoluteRepositoryRoot(root) {
  if (typeof root !== 'string' || !path.isAbsolute(root)) fail('REPOSITORY_ROOT_REQUIRED', 'An explicit absolute repository root is required.');
  return root;
}

function resolveLocalImport(repositoryRoot, rootFile, specifier) {
  const base = path.resolve(repositoryRoot, path.dirname(rootFile), specifier);
  const candidates = [base, `${base}.js`, `${base}.jsx`, `${base}.json`, path.join(base, 'index.js'), path.join(base, 'index.jsx')];
  const resolved = candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  if (!resolved) fail('RENDERER_DEPENDENCY_MISSING', `The review renderer dependency is missing: ${specifier}.`);
  return path.relative(repositoryRoot, resolved);
}

function scannerError(message) { fail('RENDERER_DEPENDENCY_PARSE_INVALID', message); }
function lexicalModuleTokens(source) {
  const tokens = [];
  let index = 0;
  const isIdentifierStart = (char) => /[A-Za-z_$]/.test(char);
  const isIdentifierPart = (char) => /[A-Za-z0-9_$]/.test(char);
  while (index < source.length) {
    const char = source[index]; const next = source[index + 1];
    if (/\s/.test(char)) { index += 1; continue; }
    if (char === '/' && next === '/') { index += 2; while (index < source.length && source[index] !== '\n') index += 1; continue; }
    if (char === '/' && next === '*') { const end = source.indexOf('*/', index + 2); if (end < 0) scannerError('The renderer dependency scanner found an unterminated block comment.'); index = end + 2; continue; }
    const previous = tokens.at(-1);
    const regexStart = char === '/' && (!previous || previous.type === 'punctuation' && ['(', '[', '{', '=', ':', ',', ';', '!', '?', '|', '&'].includes(previous.value) || previous.type === 'identifier' && ['return', 'case', 'throw', 'delete', 'void', 'typeof', 'yield', 'await'].includes(previous.value));
    if (regexStart) {
      index += 1; let escaped = false; let inClass = false; let closed = false;
      while (index < source.length) {
        const regexChar = source[index];
        if (escaped) escaped = false;
        else if (regexChar === '\\') escaped = true;
        else if (regexChar === '[') inClass = true;
        else if (regexChar === ']') inClass = false;
        else if (regexChar === '/' && !inClass) { index += 1; while (/[A-Za-z]/.test(source[index] || '')) index += 1; closed = true; break; }
        else if (regexChar === '\n' || regexChar === '\r') break;
        index += 1;
      }
      if (!closed) scannerError(`The renderer dependency scanner found an unterminated regular expression near byte ${index}.`);
      tokens.push(Object.freeze({ type: 'regex', value: '/' })); continue;
    }
    if (char === '"' || char === "'") {
      const quote = char; let value = ''; index += 1;
      while (index < source.length && source[index] !== quote) {
        if (source[index] === '\\') { if (index + 1 >= source.length) scannerError('The renderer dependency scanner found an unterminated string escape.'); value += source[index + 1]; index += 2; }
        else { value += source[index]; index += 1; }
      }
      if (index >= source.length) scannerError('The renderer dependency scanner found an unterminated string.');
      index += 1; tokens.push(Object.freeze({ type: 'string', value })); continue;
    }
    if (char === '`') {
      let value = ''; let hasInterpolation = false; index += 1;
      while (index < source.length && source[index] !== '`') {
        if (source[index] === '\\') { if (index + 1 >= source.length) scannerError('The renderer dependency scanner found an unterminated template escape.'); value += source[index + 1]; index += 2; continue; }
        if (source[index] === '$' && source[index + 1] === '{') hasInterpolation = true;
        value += source[index]; index += 1;
      }
      if (index >= source.length) scannerError('The renderer dependency scanner found an unterminated template literal.');
      index += 1; tokens.push(Object.freeze({ type: hasInterpolation ? 'template_expression' : 'string', value })); continue;
    }
    if (isIdentifierStart(char)) {
      const start = index; index += 1; while (index < source.length && isIdentifierPart(source[index])) index += 1;
      tokens.push(Object.freeze({ type: 'identifier', value: source.slice(start, index) })); continue;
    }
    tokens.push(Object.freeze({ type: 'punctuation', value: char })); index += 1;
  }
  return Object.freeze(tokens);
}
function scanModuleSpecifiers(source) {
  const tokens = lexicalModuleTokens(source); const imports = [];
  const push = (specifier, kind) => { if (typeof specifier !== 'string' || specifier.length === 0) scannerError('A renderer dependency specifier must be a non-empty literal string.'); imports.push(Object.freeze({ specifier, kind })); };
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]; const next = tokens[index + 1];
    if (token.type !== 'identifier') continue;
    if (token.value === 'require' && next?.value === '(') {
      const argument = tokens[index + 2]; const close = tokens[index + 3];
      if (argument?.type !== 'string' || close?.value !== ')') fail('RENDERER_DEPENDENCY_DYNAMIC_UNRESOLVED', 'The renderer dependency scanner rejects non-literal require calls.');
      push(argument.value, 'COMMONJS_REQUIRE'); index += 3; continue;
    }
    if (token.value !== 'import' || tokens[index - 1]?.value === '.' || next?.value === ':') continue;
    if (next?.type === 'string') { push(next.value, 'SIDE_EFFECT_IMPORT'); index += 1; continue; }
    if (next?.value === '(') {
      const argument = tokens[index + 2]; const close = tokens[index + 3];
      if (argument?.type !== 'string' || close?.value !== ')') fail('RENDERER_DEPENDENCY_DYNAMIC_UNRESOLVED', 'The renderer dependency scanner rejects non-literal dynamic imports.');
      push(argument.value, 'DYNAMIC_IMPORT'); index += 3; continue;
    }
    let cursor = index + 1;
    while (cursor < tokens.length && tokens[cursor].value !== ';' && !(tokens[cursor].type === 'identifier' && tokens[cursor].value === 'from')) cursor += 1;
    if (tokens[cursor]?.value !== 'from' || tokens[cursor + 1]?.type !== 'string') continue;
    push(tokens[cursor + 1].value, 'STATIC_IMPORT'); index = cursor + 1;
  }
  return Object.freeze(imports);
}
function directImports(source) { return scanModuleSpecifiers(source).map((entry) => entry.specifier); }
function transitiveRendererClosure(repositoryRoot, rootFile) {
  const pending = [rootFile]; const visited = new Set(); const external = new Set();
  while (pending.length) {
    const relativePath = pending.pop();
    if (visited.has(relativePath)) continue;
    visited.add(relativePath);
    for (const specifier of directImports(fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8'))) {
      if (!specifier.startsWith('.')) { external.add(specifier); continue; }
      pending.push(resolveLocalImport(repositoryRoot, relativePath, specifier));
    }
  }
  const lockPath = path.join(repositoryRoot, 'package-lock.json');
  if (!fs.existsSync(lockPath)) fail('RENDERER_RUNTIME_LOCK_MISSING', 'The renderer runtime dependency lock is required.');
  const packageLock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  return Object.freeze({
    local_files: Object.freeze([...visited].sort().map((relative_path) => Object.freeze({ relative_path, sha256: sha256Hex(fs.readFileSync(path.join(repositoryRoot, relative_path))) }))),
    external_imports: Object.freeze([...external].sort().map((specifier) => externalRuntimeEvidence(repositoryRoot, packageLock, specifier))),
  });
}

function packageNameForSpecifier(specifier) {
  if (!specifier || specifier.startsWith('.') || specifier.startsWith('/') || specifier.includes('\\')) fail('RENDERER_RUNTIME_SPECIFIER_INVALID', 'A runtime dependency specifier must be a package import.');
  const segments = specifier.split('/');
  return specifier.startsWith('@') ? segments.slice(0, 2).join('/') : segments[0];
}
function externalRuntimeEvidence(repositoryRoot, packageLock, specifier) {
  const packageName = packageNameForSpecifier(specifier);
  const packagePath = `node_modules/${packageName}`;
  const locked = packageLock?.packages?.[packagePath];
  if (!locked || typeof locked.version !== 'string' || typeof locked.integrity !== 'string') fail('RENDERER_RUNTIME_LOCK_ENTRY_MISSING', `The runtime lock entry is missing for ${packageName}.`);
  let resolved;
  try { resolved = require.resolve(specifier, { paths: [repositoryRoot] }); } catch { fail('RENDERER_RUNTIME_ENTRY_MISSING', `The installed runtime entry is missing for ${specifier}.`); }
  const relativePath = path.relative(repositoryRoot, resolved);
  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath) || !fs.existsSync(resolved)) fail('RENDERER_RUNTIME_ENTRY_OUTSIDE_REPOSITORY', `The installed runtime entry is outside the pinned repository: ${specifier}.`);
  const bytes = fs.readFileSync(resolved);
  return Object.freeze({ specifier, package_name: packageName, lock_version: locked.version, lock_integrity: locked.integrity, runtime_entry_relative_path: relativePath, runtime_entry_sha256: sha256Hex(bytes) });
}

function orderedTableConfigVariables(source) {
  const match = source.match(/const REVIEW_TABLE_CONFIGS = \[([\s\S]*?)\];/);
  if (!match) fail('RENDERER_CONFIG_ORDER_MISSING', 'The review renderer does not declare REVIEW_TABLE_CONFIGS.');
  return match[1].split(',').map((value) => value.trim()).filter(Boolean);
}

function importBindings(source) {
  const bindings = new Map();
  const expression = /import\s+(?:\{\s*([^}]+)\s*\}|([A-Za-z_$][\w$]*))\s+from\s+['"]([^'"]+)['"];?/g;
  let match;
  while ((match = expression.exec(source))) {
    const specifier = match[3];
    if (match[2]) bindings.set(match[2], specifier);
    for (const item of (match[1] || '').split(',')) {
      const trimmed = item.trim();
      if (!trimmed) continue;
      const local = trimmed.split(/\s+as\s+/).pop().trim();
      bindings.set(local, specifier);
    }
  }
  return bindings;
}

function buildRendererDependencyClosure({ repository_root: repositoryRoot } = {}) {
  absoluteRepositoryRoot(repositoryRoot);
  const rootPath = path.join(repositoryRoot, REVIEW_ROOT);
  if (!fs.existsSync(rootPath)) fail('RENDERER_ROOT_MISSING', `The V1 review renderer is missing: ${REVIEW_ROOT}.`);
  const rootBytes = fs.readFileSync(rootPath);
  const rootSource = rootBytes.toString('utf8');
  const imports = directImports(rootSource);
  if (imports.length !== DIRECT_RENDERER_DEPENDENCY_COUNT) fail('RENDERER_DEPENDENCY_COUNT_DRIFT', 'The V1 review renderer direct dependency closure is no longer 54 entries.');
  const entries = imports.map((specifier, index) => {
    const external = !specifier.startsWith('.');
    const relativePath = external ? null : resolveLocalImport(repositoryRoot, REVIEW_ROOT, specifier);
    const bytes = relativePath === null ? null : fs.readFileSync(path.join(repositoryRoot, relativePath));
    return Object.freeze({
      dependency_index: index,
      specifier,
      dependency_kind: external ? 'EXTERNAL_RUNTIME' : 'REPOSITORY_FILE',
      relative_path: relativePath,
      sha256: bytes === null ? null : sha256Hex(bytes),
    });
  });
  const transitive = transitiveRendererClosure(repositoryRoot, REVIEW_ROOT);
  const bindings = importBindings(rootSource);
  const configVariables = orderedTableConfigVariables(rootSource);
  if (configVariables.length !== TABLE_CONFIG_COUNT) fail('RENDERER_CONFIG_COUNT_DRIFT', 'The V1 review renderer table configuration order is no longer 19 entries.');
  const tableConfigOrder = configVariables.map((variableName, index) => {
    const specifier = bindings.get(variableName);
    if (!specifier) fail('RENDERER_CONFIG_BINDING_MISSING', `The renderer configuration is not imported: ${variableName}.`);
    const entry = entries.find((candidate) => candidate.specifier === specifier && candidate.dependency_kind === 'REPOSITORY_FILE');
    if (!entry) fail('RENDERER_CONFIG_DEPENDENCY_MISSING', `The renderer configuration cannot be bound: ${variableName}.`);
    return Object.freeze({ config_index: index, variable_name: variableName, specifier, relative_path: entry.relative_path, sha256: entry.sha256 });
  });
  const body = {
    schema_version: 'V1_RENDERER_DEPENDENCY_CLOSURE/V1',
    review_root: REVIEW_ROOT,
    review_root_sha256: sha256Hex(rootBytes),
    direct_dependency_count: entries.length,
    direct_local_dependency_edge_count: entries.filter((entry) => entry.dependency_kind === 'REPOSITORY_FILE').length,
    direct_unique_local_file_count: new Set(entries.filter((entry) => entry.relative_path).map((entry) => entry.relative_path)).size,
    direct_dependencies: entries,
    transitive_dependency_closure: transitive,
    table_config_count: tableConfigOrder.length,
    table_config_order: tableConfigOrder,
    selector_contract: RENDER_SELECTOR_CONTRACT,
  };
  return Object.freeze({ ...body, renderer_dependency_closure_id: contentId('V1_RENDERER_DEPENDENCY_CLOSURE/V1', body) });
}

function buildV1RenderedSurfaceAcquisitionPlan({ repository_root: repositoryRoot } = {}) {
  const closure = buildRendererDependencyClosure({ repository_root: repositoryRoot });
  const directoryPath = path.join(repositoryRoot, 'lib/generated/home-deal-directory-v1.json');
  const directory = JSON.parse(fs.readFileSync(directoryPath, 'utf8'));
  const roster = (directory.deals || []).map((deal) => deal.id).sort();
  if (roster.length !== ROSTER_SIZE || roster.some((id) => !UUID_RE.test(id)) || new Set(roster).size !== ROSTER_SIZE) fail('HOME_DIRECTORY_ROSTER_INVALID', 'The home-directory roster must contain exactly 40 distinct UUID deal identifiers.');
  const homeDirectoryRoster = Object.freeze({ relative_path: 'lib/generated/home-deal-directory-v1.json', file_sha256: sha256Hex(fs.readFileSync(directoryPath)), deal_ids: Object.freeze(roster), roster_digest: contentId('V1_RENDER_HOME_DIRECTORY_ROSTER/V1', roster) });
  const closureWithRoster = Object.freeze({ ...closure, home_directory_roster: homeDirectoryRoster });
  const body = {
    schema_version: SCHEMA,
    status: STATUS,
    authority: Object.freeze({ v1_authority: 'NONE', database_authority: 'NONE', extraction_authority: 'NONE', production_authority: 'NONE' }),
    rendered_surface_disposition: 'NO_COMPLETE_STATIC_EXPORT_DO_NOT_RECONCILE',
    renderer_dependency_closure: closureWithRoster,
    home_directory_roster: homeDirectoryRoster,
    required_immutable_artifacts: Object.freeze([
      Object.freeze({ schema_version: V1_RENDER_SOURCE_CAPTURE_SCHEMA, purpose: 'READ_ONLY_40_ROSTER_PAGINATED_TABLE_CAPTURE' }),
      Object.freeze({ schema_version: V1_RENDER_REPLAY_SCHEMA, purpose: 'FROZEN_SHAPING_AND_19_CONFIG_RENDER_REPLAY' }),
      Object.freeze({ schema_version: V1_RENDER_LEDGER_SCHEMA, purpose: 'DISPLAYED_CELLS_SOURCE_LINEAGE_AND_HIDDEN_UNMOUNTED_DISPOSITIONS' }),
    ]),
    acquisition_requirements: Object.freeze([
      'READ_ONLY_CAPTURE_COMMAND_REVIEW_REQUIRED_BEFORE_DATABASE_READ',
      'EXACT_40_DEAL_ROSTER', 'PAGINATION_EOF_PROOF', 'ROW_DIGESTS',
      'SELECTOR_EXCEPTION_FAIL_CLOSED', 'CONFIG_ORDER_BINDING',
      'REFERENCE_RESOLUTION_PROOF', 'BYTE_IDENTICAL_SECOND_REPLAY',
      'COMPLETE_HIDDEN_UNMOUNTED_DISPOSITIONS',
    ]),
  };
  return Object.freeze({ ...body, acquisition_plan_id: digest(body) });
}

function assertArtifactIdentity(artifact, schema, field) {
  if (!isPlainObject(artifact) || artifact.schema_version !== schema || typeof artifact[field] !== 'string') fail('RENDER_ARTIFACT_INVALID', `Invalid ${schema} artifact.`);
  const body = { ...artifact };
  delete body[field];
  if (artifact[field] !== contentId(schema, body)) fail('RENDER_ARTIFACT_IDENTITY_INVALID', `The ${schema} artifact identity does not bind its complete immutable body.`);
}
function bytesFromBase64(value, label) { if (typeof value !== 'string') fail('RENDER_BYTES_INVALID', `${label} bytes are required.`); const bytes = Buffer.from(value, 'base64'); if (bytes.toString('base64') !== value) fail('RENDER_BYTES_INVALID', `${label} bytes are not canonical base64.`); return bytes; }
function verifyReceiptId(schema, value, field) { const body = { ...value }; delete body[field]; if (value[field] !== contentId(schema, body)) fail('RENDER_RECEIPT_ID_INVALID', `${schema} receipt identity is invalid.`); }
function parseCanonicalPage(page) {
  const bytes = bytesFromBase64(page.body_bytes_base64, 'page'); let parsed;
  try { parsed = JSON.parse(bytes.toString('utf8')); } catch { fail('RENDER_CAPTURE_PAGE_PARSE_INVALID', 'Every captured page must be parseable UTF-8 JSON.'); }
  if (!exactKeys(parsed, ['rows']) || !Array.isArray(parsed.rows) || canonicalJson(parsed) !== bytes.toString('utf8')) fail('RENDER_CAPTURE_PAGE_PARSE_INVALID', 'Every captured page must use the exact canonical rows envelope.');
  return parsed.rows;
}
function rawCaptureDigest(inputPages) {
  return sha256Hex(canonicalJson(inputPages.slice().sort((left, right) => left.input_name.localeCompare(right.input_name) || left.page_number - right.page_number).map((page) => ({ input_name: page.input_name, page_number: page.page_number, page_id: page.page_id, raw_response_sha256: page.raw_response_sha256, body_bytes_base64: page.body_bytes_base64 }))));
}
function validateCollectorAuthority(authority) {
  assertArtifactIdentity(authority, V1_RENDER_COLLECTOR_AUTHORITY_SCHEMA, 'collector_authority_id');
  if (!exactKeys(authority, ['schema_version', 'collector_authority_id', 'collector_public_key_pem', 'request_policy']) || typeof authority.collector_public_key_pem !== 'string' || !exactKeys(authority.request_policy, ['allowed_input_names', 'allowed_methods', 'capture_mode']) || authority.request_policy.capture_mode !== 'READ_ONLY_PAGINATED_TABLE' || !sameArray(authority.request_policy.allowed_input_names, REQUIRED_REVIEW_INPUTS) || !sameArray(authority.request_policy.allowed_methods, ['GET'])) fail('RENDER_CAPTURE_COLLECTOR_AUTHORITY_INVALID', 'The collector authority is not a closed read-only authority.');
  try { crypto.createPublicKey(authority.collector_public_key_pem); } catch { fail('RENDER_CAPTURE_COLLECTOR_AUTHORITY_INVALID', 'The collector authority public key is invalid.'); }
  return true;
}
function captureAttestationPayload(capture) {
  const payload = { ...capture }; delete payload.capture_id; delete payload.collector_signature_base64; return contentId('V1_RENDER_SOURCE_CAPTURE_ATTESTATION/V1', payload);
}
function verifyCaptureSignature(capture, authority) {
  const signature = bytesFromBase64(capture.collector_signature_base64, 'collector signature');
  let verified = false;
  try { verified = crypto.verify(null, Buffer.from(captureAttestationPayload(capture), 'utf8'), authority.collector_public_key_pem, signature); } catch { fail('RENDER_CAPTURE_COLLECTOR_SIGNATURE_INVALID', 'The collector signature cannot be checked.'); }
  if (!verified) fail('RENDER_CAPTURE_COLLECTOR_SIGNATURE_INVALID', 'The collector signature does not attest this exact capture.');
}
function expectedReplayInputDigest(capture, closure, tableConfigOrder) { return sha256Hex(canonicalJson({ capture_id: capture.capture_id, renderer_dependency_closure_id: closure.renderer_dependency_closure_id, table_config_order: tableConfigOrder })); }
function expectedReplayEnvironmentDigest(closure) { return sha256Hex(canonicalJson({ renderer_dependency_closure_id: closure.renderer_dependency_closure_id, review_root_sha256: closure.review_root_sha256, transitive_dependency_closure: closure.transitive_dependency_closure })); }
function validateExecutionReceipt(receipt, { expectedInputDigest, expectedEnvironmentDigest, expectedOutputBytes } = {}) {
  assertArtifactIdentity(receipt, V1_RENDER_EXECUTION_RECEIPT_SCHEMA, 'execution_receipt_id');
  if (!exactKeys(receipt, ['schema_version', 'execution_receipt_id', 'status', 'input_set_digest', 'environment_digest', 'output_bytes_base64', 'output_sha256']) || receipt.status !== 'PASS' || receipt.input_set_digest !== expectedInputDigest || receipt.environment_digest !== expectedEnvironmentDigest || !SHA256_RE.test(receipt.output_sha256 || '') || !bytesFromBase64(receipt.output_bytes_base64, 'render output').equals(expectedOutputBytes) || sha256Hex(expectedOutputBytes) !== receipt.output_sha256) fail('RENDER_REPLAY_RECEIPT_INVALID', 'The replay execution receipt does not bind the exact inputs, environment and output bytes.');
}

function validateV1RenderSourceCapture(capture, { renderer_dependency_closure: closure, collector_authority: authority } = {}) {
  assertArtifactIdentity(capture, V1_RENDER_SOURCE_CAPTURE_SCHEMA, 'capture_id');
  if (!closure || capture.renderer_dependency_closure_id !== closure.renderer_dependency_closure_id) fail('RENDER_CAPTURE_CLOSURE_MISMATCH', 'The source capture does not bind the full renderer dependency closure.');
  if (!authority) fail('RENDER_CAPTURE_COLLECTOR_AUTHORITY_REQUIRED', 'Capture issuance is impossible without a separately reviewed collector authority.');
  validateCollectorAuthority(authority);
  if (!exactKeys(capture, ['schema_version', 'capture_id', 'collector_authority_id', 'collector_signature_base64', 'renderer_dependency_closure_id', 'capture_mode', 'selector_contract', 'home_directory_roster_digest', 'pagination', 'rows', 'input_pages', 'network_log', 'raw_capture_sha256', 'source_record_count']) || capture.collector_authority_id !== authority.collector_authority_id || capture.capture_mode !== 'READ_ONLY_PAGINATED_TABLE' || !Array.isArray(capture.rows) || !isPlainObject(capture.pagination) || !sameArray(capture.selector_contract, closure.selector_contract) || !Array.isArray(capture.network_log) || !Array.isArray(capture.input_pages)) fail('RENDER_CAPTURE_INVALID', 'The source capture is not a closed read-only paginated receipt.');
  verifyCaptureSignature(capture, authority);
  if (!Number.isSafeInteger(capture.source_record_count) || capture.source_record_count <= ROSTER_SIZE || capture.raw_capture_sha256 !== rawCaptureDigest(capture.input_pages)) fail('RENDER_CAPTURE_RAW_COVERAGE_INVALID', 'The capture must recompute complete raw page coverage, not retain a declared digest.');
  if (!exactKeys(capture.pagination, ['row_count', 'eof_reached', 'selector_exceptions']) || capture.rows.length < ROSTER_SIZE || capture.pagination.row_count !== ROSTER_SIZE || capture.pagination.eof_reached !== true) fail('RENDER_CAPTURE_ROSTER_INCOMPLETE', 'The source capture must prove the exact 40-deal roster and EOF.');
  if (!Array.isArray(capture.pagination.selector_exceptions) || capture.pagination.selector_exceptions.length !== 0) fail('RENDER_CAPTURE_SELECTOR_EXCEPTION', 'A selector exception invalidates the source capture.');
  const dealIds = [...new Set(capture.rows.map((row) => row && row.deal_id))].sort();
  if (!closure.home_directory_roster || capture.home_directory_roster_digest !== closure.home_directory_roster.roster_digest || !sameArray(dealIds, closure.home_directory_roster.deal_ids)) fail('RENDER_CAPTURE_ROSTER_INVALID', 'The source capture must bind the exact home-directory UUID roster.');
  const pageRows = new Map();
  if (!sameArray([...new Set(capture.input_pages.map((page) => page.input_name))].sort(), REQUIRED_REVIEW_INPUTS) || capture.input_pages.some((page) => !exactKeys(page, ['input_name', 'page_number', 'eof_reached', 'url', 'method', 'status', 'body_bytes_base64', 'raw_response_sha256', 'row_count', 'page_id']) || !REQUIRED_REVIEW_INPUTS.includes(page.input_name) || !Number.isSafeInteger(page.page_number) || page.page_number < 1 || page.method !== 'GET' || page.status !== 200 || !SHA256_RE.test(page.raw_response_sha256 || '') || sha256Hex(bytesFromBase64(page.body_bytes_base64, 'page')) !== page.raw_response_sha256 || page.page_id !== contentId('V1_RENDER_INPUT_PAGE/V1', { input_name: page.input_name, page_number: page.page_number, url: page.url, raw_response_sha256: page.raw_response_sha256, row_count: page.row_count }) || !Number.isSafeInteger(page.row_count) || page.row_count < 0)) fail('RENDER_CAPTURE_INPUT_PAGES_INCOMPLETE', 'The capture must enumerate exact GET 200 pages with canonical raw bytes and IDs.');
  for (const page of capture.input_pages) { const rows = parseCanonicalPage(page); if (rows.length !== page.row_count) fail('RENDER_CAPTURE_PAGE_ROW_COUNT_INVALID', 'The parsed page row count does not match the declared page row count.'); pageRows.set(page.page_id, rows); }
  for (const inputName of REQUIRED_REVIEW_INPUTS) { const pages = capture.input_pages.filter((page) => page.input_name === inputName).sort((left, right) => left.page_number - right.page_number); if (!pages.length || pages.some((page, index) => page.page_number !== index + 1 || (index < pages.length - 1 && page.eof_reached !== false)) || pages.at(-1).eof_reached !== true) fail('RENDER_CAPTURE_INPUT_PAGES_INCOMPLETE', 'Every reviewer input, including paginated claims, must have sequential pages and one EOF proof.'); }
  const pageIds = new Set(capture.input_pages.map((page) => page.page_id));
  for (const row of capture.rows) {
    if (!exactKeys(row, ['source_record_id', 'deal_id', 'input_page_id', 'page_row_index', 'row_bytes_base64', 'row_digest']) || typeof row.source_record_id !== 'string' || !UUID_RE.test(row.deal_id || '') || !pageIds.has(row.input_page_id) || !Number.isSafeInteger(row.page_row_index) || row.page_row_index < 0 || !SHA256_RE.test(row.row_digest || '') || sha256Hex(bytesFromBase64(row.row_bytes_base64, 'row')) !== row.row_digest || row.source_record_id !== contentId('V1_RENDER_SOURCE_ROW/V1', { input_page_id: row.input_page_id, page_row_index: row.page_row_index, row_digest: row.row_digest })) fail('RENDER_CAPTURE_ROW_DIGEST_MISSING', 'Every captured row must have canonical bytes and a bound content identifier.');
    const parsedRow = pageRows.get(row.input_page_id)?.[row.page_row_index]; const rowBytes = bytesFromBase64(row.row_bytes_base64, 'row');
    if (!isPlainObject(parsedRow) || !rowBytes.equals(Buffer.from(canonicalJson(parsedRow), 'utf8'))) fail('RENDER_CAPTURE_ROW_PAGE_MISMATCH', 'Every captured row must reconstruct exactly from its parsed source page.');
  }
  if (new Set(capture.rows.map((row) => row.source_record_id)).size !== capture.rows.length) fail('RENDER_CAPTURE_SOURCE_RECORD_DUPLICATE', 'Every captured source record identifier must be unique.');
  const expectedRowSlots = [...pageRows.entries()].flatMap(([pageId, rows]) => rows.map((_, pageRowIndex) => `${pageId}:${pageRowIndex}`)).sort(); const actualRowSlots = capture.rows.map((row) => `${row.input_page_id}:${row.page_row_index}`).sort();
  if (!sameArray(actualRowSlots, expectedRowSlots) || capture.source_record_count !== capture.rows.length || capture.source_record_count !== capture.input_pages.reduce((total, page) => total + page.row_count, 0)) fail('RENDER_CAPTURE_RAW_COVERAGE_INVALID', 'The source records must be an exact one-to-one mapping of every parsed raw page row.');
  if (capture.network_log.some((request) => !exactKeys(request, ['method', 'url', 'status', 'page_id']) || request.method !== 'GET' || request.status !== 200 || !pageIds.has(request.page_id)) || capture.network_log.length !== capture.input_pages.length || new Set(capture.network_log.map((request) => request.page_id)).size !== capture.input_pages.length || capture.network_log.some((request) => capture.input_pages.find((page) => page.page_id === request.page_id)?.url !== request.url)) fail('RENDER_CAPTURE_NETWORK_AUDIT_INVALID', 'The full network log must be exact, GET-only and bind every captured page.');
  return true;
}

function validateV1RenderReplay(replay, { capture, renderer_dependency_closure: closure } = {}) {
  assertArtifactIdentity(replay, V1_RENDER_REPLAY_SCHEMA, 'replay_id');
  if (!capture || replay.capture_id !== capture.capture_id || replay.renderer_dependency_closure_id !== closure?.renderer_dependency_closure_id) fail('RENDER_REPLAY_BINDING_INVALID', 'The replay is not bound to its capture and renderer closure.');
  if (!exactKeys(replay, ['schema_version', 'replay_id', 'capture_id', 'renderer_dependency_closure_id', 'table_config_order', 'byte_identical_second_replay', 'rendered_output_bytes_base64', 'rendered_output_sha256', 'reference_resolution', 'first_execution_receipt', 'second_execution_receipt']) || !sameArray(replay.table_config_order, closure.table_config_order)) fail('RENDER_REPLAY_CONFIG_ORDER_DRIFT', 'The replay table configuration order does not match the frozen renderer.');
  const outputBytes = bytesFromBase64(replay.rendered_output_bytes_base64, 'replayed render output');
  if (replay.byte_identical_second_replay !== true || sha256Hex(outputBytes) !== replay.rendered_output_sha256) fail('RENDER_REPLAY_NONDETERMINISTIC', 'The replay must retain exact rendered bytes and a recomputed digest.');
  const expectedInputDigest = expectedReplayInputDigest(capture, closure, replay.table_config_order); const expectedEnvironmentDigest = expectedReplayEnvironmentDigest(closure);
  validateExecutionReceipt(replay.first_execution_receipt, { expectedInputDigest, expectedEnvironmentDigest, expectedOutputBytes: outputBytes });
  validateExecutionReceipt(replay.second_execution_receipt, { expectedInputDigest, expectedEnvironmentDigest, expectedOutputBytes: outputBytes });
  if (!exactKeys(replay.reference_resolution, ['unresolved_reference_count', 'reference_edge_count', 'reference_edges_digest']) || replay.reference_resolution.unresolved_reference_count !== 0 || !Number.isSafeInteger(replay.reference_resolution.reference_edge_count) || replay.reference_resolution.reference_edge_count < 0 || !SHA256_RE.test(replay.reference_resolution.reference_edges_digest || '')) fail('RENDER_REPLAY_REFERENCE_UNRESOLVED', 'The replay contains unresolved or unenumerated references.');
  return true;
}

function validateV1RenderLedger(ledger, { capture, replay } = {}) {
  assertArtifactIdentity(ledger, V1_RENDER_LEDGER_SCHEMA, 'ledger_id');
  if (!capture || !replay || ledger.capture_id !== capture.capture_id || ledger.replay_id !== replay.replay_id || !exactKeys(ledger, ['schema_version', 'ledger_id', 'capture_id', 'replay_id', 'displayed_cells', 'source_lineage', 'hidden_unmounted_dispositions', 'reference_edges'])) fail('RENDER_LEDGER_BINDING_INVALID', 'The ledger is not bound to the capture and replay.');
  if (!Array.isArray(ledger.displayed_cells) || !Array.isArray(ledger.source_lineage) || !Array.isArray(ledger.hidden_unmounted_dispositions) || !Array.isArray(ledger.reference_edges)) fail('RENDER_LEDGER_INCOMPLETE', 'The ledger must include displayed cells, lineage, dispositions and reference edges.');
  const capturedRows = new Map(capture.rows.map((row) => [row.source_record_id, row])); const all = [...ledger.displayed_cells, ...ledger.hidden_unmounted_dispositions];
  if (all.some((row) => !isPlainObject(row) || typeof row.source_record_id !== 'string' || !capturedRows.has(row.source_record_id)) || new Set(all.map((row) => row.source_record_id)).size !== all.length) fail('RENDER_LEDGER_DISPOSITION_INVALID', 'Every source record must have one explicit displayed or hidden/unmounted disposition.');
  const selectorIds = new Set(['DISPLAYED_CELL', 'CONFIG_SECTION', 'CONFIG_RENDER_BODY']);
  for (const cell of ledger.displayed_cells) {
    const source = capturedRows.get(cell.source_record_id); const expectedTableId = replay.table_config_order[cell.config_index]?.variable_name;
    if (!exactKeys(cell, ['source_record_id', 'deal_id', 'cell_bytes_base64', 'cell_digest', 'dom_bytes_base64', 'dom_bytes_sha256', 'config_index', 'column_index', 'selector_id', 'table_id', 'disposition']) || cell.disposition !== 'DISPLAYED' || cell.deal_id !== source?.deal_id || !Number.isSafeInteger(cell.config_index) || cell.config_index < 0 || cell.config_index >= replay.table_config_order.length || !Number.isSafeInteger(cell.column_index) || cell.column_index < 0 || cell.column_index > 99 || !selectorIds.has(cell.selector_id) || cell.table_id !== expectedTableId || sha256Hex(bytesFromBase64(cell.cell_bytes_base64, 'cell')) !== cell.cell_digest || sha256Hex(bytesFromBase64(cell.dom_bytes_base64, 'DOM cell')) !== cell.dom_bytes_sha256) fail('RENDER_LEDGER_CELL_INVALID', 'Every displayed cell must bind exact cell bytes and bounded renderer lineage.');
    let dom; try { dom = JSON.parse(bytesFromBase64(cell.dom_bytes_base64, 'DOM cell').toString('utf8')); } catch { fail('RENDER_LEDGER_CELL_DERIVATION_INVALID', 'A displayed DOM record must be canonical JSON.'); }
    const domBytes = bytesFromBase64(cell.dom_bytes_base64, 'DOM cell');
    if (!exactKeys(dom, ['cell_text', 'column_index', 'config_index', 'deal_id', 'selector_id', 'source_record_id', 'table_id']) || canonicalJson(dom) !== domBytes.toString('utf8') || dom.source_record_id !== cell.source_record_id || dom.deal_id !== cell.deal_id || dom.config_index !== cell.config_index || dom.column_index !== cell.column_index || dom.selector_id !== cell.selector_id || dom.table_id !== cell.table_id || !bytesFromBase64(cell.cell_bytes_base64, 'cell').equals(Buffer.from(dom.cell_text, 'utf8'))) fail('RENDER_LEDGER_CELL_DERIVATION_INVALID', 'The cell bytes must reconstruct exactly from the captured DOM record.');
  }
  if (ledger.hidden_unmounted_dispositions.some((row) => !exactKeys(row, ['source_record_id', 'disposition', 'reason_code']) || !HIDDEN_UNMOUNTED_REASON_CODES[row.disposition]?.includes(row.reason_code))) fail('RENDER_LEDGER_DISPOSITION_INVALID', 'Hidden and unmounted records must use a closed disposition and reason schema.');
  for (const lineage of ledger.source_lineage) { const source = capturedRows.get(lineage.source_record_id); if (!exactKeys(lineage, ['source_record_id', 'deal_id', 'input_page_id', 'row_digest']) || !source || lineage.deal_id !== source.deal_id || lineage.input_page_id !== source.input_page_id || lineage.row_digest !== source.row_digest) fail('RENDER_LEDGER_LINEAGE_INVALID', 'Every source lineage entry must bind the exact source row, deal and page.'); }
  if (ledger.reference_edges.some((edge) => !exactKeys(edge, ['source_record_id', 'target_source_record_id', 'edge_type', 'evidence_bytes_base64', 'evidence_sha256', 'edge_digest']) || !capturedRows.has(edge.source_record_id) || !capturedRows.has(edge.target_source_record_id) || !REFERENCE_EDGE_TYPES.includes(edge.edge_type) || sha256Hex(bytesFromBase64(edge.evidence_bytes_base64, 'reference evidence')) !== edge.evidence_sha256 || edge.edge_digest !== contentId('V1_RENDER_REFERENCE_EDGE/V1', { source_record_id: edge.source_record_id, target_source_record_id: edge.target_source_record_id, edge_type: edge.edge_type, evidence_sha256: edge.evidence_sha256 }))) fail('RENDER_LEDGER_REFERENCE_INVALID', 'Every reference edge must bind typed exact source, target and evidence bytes.');
  if (new Set(ledger.reference_edges.map((edge) => edge.edge_digest)).size !== ledger.reference_edges.length || replay.reference_resolution.reference_edge_count !== ledger.reference_edges.length || replay.reference_resolution.reference_edges_digest !== sha256Hex(canonicalJson(ledger.reference_edges.slice().sort((left, right) => left.edge_digest.localeCompare(right.edge_digest))))) fail('RENDER_REFERENCE_EDGE_COUNT_MISMATCH', 'Replay reference resolution must recompute every exact ledger reference edge.');
  const dispositionIds = [...new Set(all.map((row) => row.source_record_id))].sort(); const lineageIds = [...new Set(ledger.source_lineage.map((row) => row.source_record_id))].sort(); const capturedIds = [...capturedRows.keys()].sort();
  if (!sameArray(dispositionIds, capturedIds) || !sameArray(lineageIds, capturedIds) || lineageIds.length !== ledger.source_lineage.length) fail('RENDER_LEDGER_SOURCE_COVERAGE_INCOMPLETE', 'Every captured source record requires exactly one disposition and one lineage entry.');
  return true;
}

function validateV1RenderedSurfaceArtifactSet() {
  fail(
    TRUSTED_V1_CAPTURE_AND_REPLAY_EXECUTOR_NOT_IMPLEMENTED,
    'V1 rendered-surface certification is blocked until a separately reviewed trusted capture controller and replay executor exist.',
  );
}

// Compatibility name.  It now returns only the fail-closed plan, never a
// reconciliation result or a static V1 evidence count.
function buildV1OutputRoutingReconciliationAudit({ repository_root: repositoryRoot } = {}) {
  return buildV1RenderedSurfaceAcquisitionPlan({ repository_root: repositoryRoot });
}
function collectEvidenceRecords() {
  fail('STATIC_EVIDENCE_INCOMPLETE', 'No complete static V1 rendered export exists. Acquire and validate the immutable rendered-surface artifacts before reading V1 evidence.');
}
function validateV1OutputRoutingReconciliationAudit(audit, { repository_root: repositoryRoot } = {}) {
  const rebuilt = buildV1RenderedSurfaceAcquisitionPlan({ repository_root: repositoryRoot });
  if (!sameArray(audit, rebuilt)) fail('V1_RECONCILIATION_AUDIT_INVALID', 'The rendered-surface acquisition plan has drifted.');
  return true;
}

module.exports = {
  SCHEMA, STATUS, V1_RENDER_SOURCE_CAPTURE_SCHEMA, V1_RENDER_REPLAY_SCHEMA, V1_RENDER_LEDGER_SCHEMA, V1_RENDER_COLLECTOR_AUTHORITY_SCHEMA, V1_RENDER_EXECUTION_RECEIPT_SCHEMA, TRUSTED_V1_CAPTURE_AND_REPLAY_EXECUTOR_NOT_IMPLEMENTED,
  REVIEW_ROOT, ROSTER_SIZE, DIRECT_RENDERER_DEPENDENCY_COUNT, TABLE_CONFIG_COUNT, RENDER_SELECTOR_CONTRACT, HIDDEN_UNMOUNTED_REASON_CODES, REFERENCE_EDGE_TYPES,
  V1OutputRoutingReconciliationAuditError, buildRendererDependencyClosure,
  buildV1RenderedSurfaceAcquisitionPlan, validateCollectorAuthority, scanModuleSpecifiers, rawCaptureDigest, expectedReplayInputDigest, expectedReplayEnvironmentDigest, validateV1RenderSourceCapture,
  validateV1RenderReplay, validateV1RenderLedger, validateV1RenderedSurfaceArtifactSet,
  buildV1OutputRoutingReconciliationAudit, validateV1OutputRoutingReconciliationAudit, collectEvidenceRecords,
};
