'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {
  PHASE1_BASE_COMMIT,
  PURE_PROPOSAL_SOURCES,
  PURE_PROPOSAL_SIGNATURE_VERIFICATION_SOURCES,
  LOCAL_ARTIFACT_WRITERS,
  RECORDED_PROVIDER_REPLAY_WRITERS,
  LIVE_MODEL_ADJUDICATION_RUNS,
  LIVE_MODEL_EXPERIMENT_RUNS,
  LIVE_MODEL_CLI_EXPERIMENT_RUNS,
  LIVE_EXTRACTION_ORCHESTRATORS,
  READ_ONLY_GIT_INSPECTORS,
  READ_ONLY_GIT_ARTIFACT_WRITERS,
  LOCAL_SUBPROCESS_ARTIFACT_WRITERS,
  REMOTE_GIT_REVIEW_INSPECTORS,
  REMOTE_GIT_REVIEW_GATED_ARTIFACT_WRITERS,
  REMOTE_SOURCE_ADMISSION_WRITERS,
  LOCAL_REVIEW_SERVER_WRITERS,
  PRODUCTION_PATH_PURE_ANALYSIS_SOURCES,
  LIVE_EXTRACTION_RUN_SOURCES,
  LOCAL_DATABASE_PROOF_SOURCES,
  LIVE_REQUEST_AUTHORIZATION_SOURCES,
  LIVE_REQUEST_AUTHORIZATION_SESSION_SOURCES,
  LIVE_REQUEST_AUTHORIZATION_CLIENT_SOURCES,
  CONTAINED_ROUTE_REPAIR_SOURCES,
  CONTAINED_ROUTE_REPAIR_GUARDED_FETCH_SOURCES,
  REQUIRED_AUTHORITY_BOUNDARY_CONTRACT_SOURCES,
  EXPLICIT_NEW_SOURCE_CLASSES,
  classifyChangedProductionSources,
} = require('../lib/canonical-v2/phase1-authority-boundary-inventory');
const {
  captureDiscoveryRecords,
} = require('../lib/canonical-v2/corpus-source-discovery-capture');

const ROOT = path.resolve(__dirname, '..');
const PRODUCTION_ROOTS = Object.freeze(['lib', 'scripts', 'pages', 'components']);
const SOURCE_EXTENSION = /\.(?:[cm]?js|jsx|mjs|ts|tsx)$/;
// ---------------------------------------------------------------------------------------
// Capability scan: real AST analysis (acorn, ESTree; JSX lowered through sucrase when
// acorn rejects raw source) rather than text matching over the raw file. Same toolchain,
// same reasoning, as lib/canonical-v2/native-producer/m3-family-parity-register.js.
//
// The textual regex scanner this replaced had three proven holes (2026-08-05 audit):
//   1. It matched capability-shaped text inside comments and unrelated string literals --
//      a comment reading "calls getServiceSupabase() itself" counted as a database call.
//   2. crypto.subtle.sign/.verify (Web Crypto) did not match a signing pattern written
//      only for Node's `crypto` module -- lib/auth/session.js, which performs the real
//      session HMAC, scanned as exercising zero capabilities.
//   3. A receiver-anchored pattern (`https?\.(request|get)\(`, `(db|supabase|database)\.
//      (from|rpc|...)\(`) evaded the moment the receiver was reached through a renamed or
//      aliased binding -- lib/broad-corpus/contained-routes/from-url-fetch.js's
//      `{ httpsClient = https }` default-parameter alias, and (found while building this
//      fix, same species) lib/broad-corpus/contained-routes/users.js and
//      reprocess-cond.js's `{ getSupabase = getServiceSupabase }`.
//
// All three are structural, not spelling gaps: a pattern list only catches spellings
// someone thought of. This scanner instead resolves what a call's receiver actually IS --
// through import/require bindings, local aliasing (const assignment and default
// parameters, chained in source order), and return-passthrough wrapper functions
// (`function getSubtle() { ...; return crypto.subtle; }` makes `getSubtle()` itself
// resolve to `crypto.subtle`) -- and never treats a Comment node, or the text of an
// unrelated String/Template literal, as a code reference.
//
// Coverage limits, recorded so they are not mistaken for rigour this does not have:
// aliasing is a flat, whole-file table, not lexically scoped (a name reused across two
// unrelated closures shares one entry -- over-approximation, so the failure mode is more
// detection, never less); resolution is a single forward pass in source order, so an
// alias or wrapper must be DECLARED before it is used, and backward references, cycles,
// and reassignment via plain `=` after declaration are not traced; a dynamically computed
// require specifier remains invisible to static analysis. Literal computed members such as
// `obj['request']` are resolved, while an unknown HTTP/global member is conservatively
// treated as network-capable. SQL and "vercel deploy" phrase detection
// still pattern-matches literal string/template content, so (as before) a prose string
// merely mentioning either phrase can still register -- comments are no longer reachable
// at all, but literal string content was, and remains, matched on text.
//
// Two mitigations narrow the practical bite of the "reassignment/indirection is not
// traced" limit above, verified empirically (2026-08-05) rather than assumed: (1) merely
// requiring 'http'/'https'/'child_process' or importing '@anthropic-ai/sdk' is ALREADY
// sufficient evidence on its own (bumpForModuleSpecifier), independent of how the binding
// is later used, so most indirection against those three specifiers (destructuring a
// method off the module, `.call()`/`.bind()` indirection, computed member access) still
// registers via the import itself even when the specific call site does not; (2) a call to
// a known factory/receiver name (getServiceSupabase, createClient, crypto.createPrivateKey,
// activate_candidate_release, ...) is recognised anywhere it textually occurs, including
// inside a plain reassignment (`x = getServiceSupabase()`), because that check runs against
// every CallExpression node regardless of its parent. The gap that remains uncovered by
// either mitigation, and the one this file's own reassignment tests exercise, is narrower
// than "reassignment after declaration" suggests: a capability-bearing VALUE (not a factory
// call) assigned to a fresh name via plain `=` -- e.g. `let s; s = crypto.subtle; s.sign(...)`,
// or requiring 'fs' under one name and reassigning a second name to it before calling
// `.writeFileSync` -- has no safety net, because database/filesystem/signing imports are
// deliberately excluded from the import-alone rule (see bumpForModuleSpecifier's own
// comment) and Web Crypto's global `crypto` object is never "required" at all.
// ---------------------------------------------------------------------------------------

let capabilityParserToolchain;
function capabilityParsers() {
  if (capabilityParserToolchain === undefined) {
    let acorn = null;
    let sucrase = null;
    try {
      // eslint-disable-next-line global-require
      acorn = require('next/dist/compiled/acorn');
    } catch {
      acorn = null;
    }
    try {
      // eslint-disable-next-line global-require
      sucrase = require('sucrase');
    } catch {
      sucrase = null;
    }
    capabilityParserToolchain = { acorn, sucrase };
  }
  return capabilityParserToolchain;
}

const CAPABILITY_ACORN_OPTIONS = Object.freeze({
  ecmaVersion: 'latest',
  allowReturnOutsideFunction: true,
  allowAwaitOutsideFunction: true,
  allowHashBang: true,
  allowSuperOutsideMethod: true,
});

// null means genuinely unparseable (not "no capabilities found") -- callers must fail
// closed on null, never treat it as a clean scan.
function parseCapabilitySource(source, filePath) {
  const { acorn, sucrase } = capabilityParsers();
  if (!acorn) return null;
  for (const sourceType of ['module', 'script']) {
    try {
      return acorn.parse(source, { ...CAPABILITY_ACORN_OPTIONS, sourceType });
    } catch {
      // CommonJS permits some declarations that module grammar rejects.
    }
  }
  if (!sucrase) return null;
  try {
    const lowered = sucrase.transform(source, {
      transforms: ['jsx'],
      filePath: filePath || 'module.jsx',
      production: true,
    }).code;
    for (const sourceType of ['module', 'script']) {
      try {
        return acorn.parse(lowered, { ...CAPABILITY_ACORN_OPTIONS, sourceType });
      } catch {
        // Try both grammars before treating lowered JSX as opaque.
      }
    }
  } catch {
    // Fall through to the fail-closed null result.
  }
  return null;
}

const CAPABILITY_AST_SKIP_KEYS = Object.freeze(new Set(['type', 'start', 'end', 'loc', 'range', 'comments']));

// `visit` may return false to prune the subtree. Comments are never part of this tree --
// acorn does not attach them unless asked to -- so nothing here can ever "see" one.
function walkCapabilityAst(node, visit) {
  if (Array.isArray(node)) {
    for (const child of node) walkCapabilityAst(child, visit);
    return;
  }
  if (!node || typeof node !== 'object' || typeof node.type !== 'string') return;
  if (visit(node) === false) return;
  for (const key of Object.keys(node)) {
    if (CAPABILITY_AST_SKIP_KEYS.has(key)) continue;
    const child = node[key];
    if (child && typeof child === 'object') walkCapabilityAst(child, visit);
  }
}

function staticMemberName(node) {
  if (!node || node.type !== 'MemberExpression') return null;
  if (!node.computed && node.property.type === 'Identifier') return node.property.name;
  if (node.computed && node.property.type === 'Literal'
      && typeof node.property.value === 'string') return node.property.value;
  return null;
}

const CAPABILITY_NAMES = Object.freeze([
  'database', 'network', 'provider', 'signing',
  'deployment_or_activation', 'external_process', 'filesystem_write',
]);

// Node builtin module specifiers that carry a capability, keyed both bare and `node:`-
// prefixed -- the exact spelling gap that let `require('https')` (no prefix) through.
const NODE_BUILTIN_CAPABILITY_MODULES = Object.freeze({
  http: 'HTTP_MODULE',
  https: 'HTTP_MODULE',
  'node:http': 'HTTP_MODULE',
  'node:https': 'HTTP_MODULE',
  child_process: 'CHILD_PROCESS_MODULE',
  'node:child_process': 'CHILD_PROCESS_MODULE',
  fs: 'FS_MODULE',
  'fs/promises': 'FS_MODULE',
  'node:fs': 'FS_MODULE',
  'node:fs/promises': 'FS_MODULE',
  crypto: 'CRYPTO',
  'node:crypto': 'CRYPTO',
});

const FS_WRITE_METHODS = Object.freeze(new Set([
  'writeFile', 'writeFileSync', 'appendFile', 'appendFileSync', 'mkdir', 'mkdirSync',
  'rename', 'renameSync', 'unlink', 'unlinkSync', 'rm', 'rmSync', 'writeSync',
]));
const CHILD_PROCESS_METHODS = Object.freeze(new Set(['execFileSync', 'execSync', 'spawnSync', 'spawn']));
const HTTP_METHODS = Object.freeze(new Set(['request', 'get']));
// Sign/verify are Web Crypto's SubtleCrypto methods too (crypto.subtle.sign/.verify) --
// deliberately symmetric with `verify`, which the old pattern list omitted even for
// Node's own crypto.verify/createVerify (found while building this fix; see the report).
// createPublicKey is the verification-side counterpart to createPrivateKey -- the same
// symmetry gap as sign/verify, and found the same way: lib/canonical-v2/
// v1-output-routing-reconciliation-audit.js calls both crypto.createPublicKey(...) and
// crypto.verify(...) two lines apart, in the same signature-verification routine.
const CRYPTO_MEMBER_METHODS = Object.freeze(new Set(['sign', 'verify', 'createSign', 'createVerify', 'createPrivateKey', 'createPublicKey']));
const CRYPTO_ANY_RECEIVER_NAMES = Object.freeze(new Set(['createPrivateKey', 'createPublicKey', 'createSign', 'createVerify']));
const DB_CLIENT_METHODS = Object.freeze(new Set(['from', 'rpc', 'insert', 'upsert', 'update', 'delete']));
const DB_FACTORY_NAMES = Object.freeze(new Set(['createClient', 'getServiceSupabase']));
const PROVIDER_ANY_RECEIVER_NAMES = Object.freeze(new Set(['createCodexCliProvider', 'createAnthropicProvider', 'createCodexCliClient', 'executeUnifiedRun']));
const DEPLOYMENT_ANY_RECEIVER_NAMES = Object.freeze(new Set(['activate_candidate_release']));
const DB_NAME_FALLBACK = Object.freeze(new Set(['db', 'supabase', 'database']));
const FS_NAME_FALLBACK = Object.freeze(new Set(['fs', 'fsPromises']));
const HTTP_NAME_FALLBACK = Object.freeze(new Set(['http', 'https']));
const SQL_PHRASE = /\b(?:INSERT\s+INTO|DELETE\s+FROM)\b/i;
const VERCEL_DEPLOY_PHRASE = /\bvercel\s+deploy\b/i;
const ANTHROPIC_SDK_SPECIFIER = '@anthropic-ai/sdk';

function isAnthropicSdkSpecifier(specifier) {
  return specifier === ANTHROPIC_SDK_SPECIFIER || specifier.startsWith(`${ANTHROPIC_SDK_SPECIFIER}/`);
}

const PURE_FORBIDDEN_CAPABILITIES = CAPABILITY_NAMES;
const LOCAL_WRITER_FORBIDDEN_CAPABILITIES = Object.freeze(PURE_FORBIDDEN_CAPABILITIES.filter((name) => name !== 'filesystem_write'));
const RECORDED_PROVIDER_REPLAY_WRITER_FORBIDDEN_CAPABILITIES = Object.freeze(PURE_FORBIDDEN_CAPABILITIES.filter((name) => !['provider', 'filesystem_write'].includes(name)));
const LIVE_MODEL_ADJUDICATION_RUN_FORBIDDEN_CAPABILITIES = Object.freeze(PURE_FORBIDDEN_CAPABILITIES.filter((name) => !['provider', 'filesystem_write'].includes(name)));
const LIVE_MODEL_EXPERIMENT_RUN_FORBIDDEN_CAPABILITIES = Object.freeze(PURE_FORBIDDEN_CAPABILITIES.filter((name) => !['provider', 'external_process', 'filesystem_write'].includes(name)));
const LIVE_EXTRACTION_ORCHESTRATOR_FORBIDDEN_CAPABILITIES = Object.freeze(PURE_FORBIDDEN_CAPABILITIES.filter((name) => !['external_process', 'filesystem_write'].includes(name)));
const GIT_INSPECTOR_FORBIDDEN_CAPABILITIES = Object.freeze(LOCAL_WRITER_FORBIDDEN_CAPABILITIES.filter((name) => name !== 'external_process').concat('filesystem_write'));
const GIT_ARTIFACT_WRITER_FORBIDDEN_CAPABILITIES = Object.freeze(PURE_FORBIDDEN_CAPABILITIES.filter((name) => !['external_process', 'filesystem_write'].includes(name)));
const LOCAL_SUBPROCESS_WRITER_FORBIDDEN_CAPABILITIES = GIT_ARTIFACT_WRITER_FORBIDDEN_CAPABILITIES;
const REMOTE_GIT_REVIEW_INSPECTOR_FORBIDDEN_CAPABILITIES = Object.freeze(PURE_FORBIDDEN_CAPABILITIES.filter((name) => !['network', 'external_process'].includes(name)));
const REMOTE_GIT_REVIEW_GATED_WRITER_FORBIDDEN_CAPABILITIES = Object.freeze(PURE_FORBIDDEN_CAPABILITIES.filter((name) => !['network', 'external_process', 'filesystem_write'].includes(name)));
const NETWORK_WRITER_FORBIDDEN_CAPABILITIES = Object.freeze(PURE_FORBIDDEN_CAPABILITIES.filter((name) => !['network', 'filesystem_write'].includes(name)));
// A live extraction run is allowed exactly the three capabilities that make
// it what it is -- provider (the real model call), external_process (the
// `claude` CLI it spawns) and filesystem_write (its receipts/evidence) --
// and nothing that would give it database, network, signing, or deployment
// authority.
const LIVE_EXTRACTION_RUN_FORBIDDEN_CAPABILITIES = Object.freeze(PURE_FORBIDDEN_CAPABILITIES.filter((name) => !['provider', 'external_process', 'filesystem_write'].includes(name)));
// Step 4A's local durable-write proof harness: the first source in this
// programme carrying `database` at all. It is allowed exactly `database`
// (it connects to a local Postgres container with `pg`) and
// `filesystem_write` (it reads committed evidence and writes its receipts),
// and nothing else -- in particular no `provider`, because it never calls a
// model: it replays already-committed evidence. What keeps `database`
// honest here is that no production credential exists in this repository;
// the class is deliberately narrow and holds one script for that reason.
const LOCAL_DATABASE_PROOF_FORBIDDEN_CAPABILITIES = Object.freeze(PURE_FORBIDDEN_CAPABILITIES.filter((name) => !['database', 'filesystem_write'].includes(name)));
// The session/credential mechanism: genuinely live, but the same full
// zero-capability boundary as PURE_PROPOSAL -- see the class's own comment
// in phase1-authority-boundary-inventory.js for why it is recorded as live
// anyway.
const LIVE_REQUEST_AUTHORIZATION_FORBIDDEN_CAPABILITIES = PURE_FORBIDDEN_CAPABILITIES;
// The session-token HMAC alone (lib/auth/session.js), split out of
// LIVE_REQUEST_AUTHORIZATION_SOURCES: same boundary as the rest of that
// mechanism, minus the one capability (`signing`) its own crypto.subtle
// sign/verify pair requires. See LIVE_REQUEST_AUTHORIZATION_SESSION_SOURCES
// in the inventory for why this is a narrower carve-out than "signing
// permitted" reads on its own -- assertLiveRequestAuthorizationSessionBoundary
// below enforces the narrower shape (Web Crypto only; Node's `crypto`
// module must never be required).
const LIVE_REQUEST_AUTHORIZATION_SESSION_FORBIDDEN_CAPABILITIES = Object.freeze(PURE_FORBIDDEN_CAPABILITIES.filter((name) => name !== 'signing'));
// The one client-side member of that surface: same boundary, minus the one
// capability (`network`) its own same-origin fetch() calls require.
const LIVE_REQUEST_AUTHORIZATION_CLIENT_FORBIDDEN_CAPABILITIES = Object.freeze(PURE_FORBIDDEN_CAPABILITIES.filter((name) => name !== 'network'));
// Held-dormant repairs for routes the live pages/api/** file still contains:
// `database` is the one capability permitted (that is the repaired
// functionality itself); every other one of the seven, including `network`,
// stays forbidden for these three -- see
// CONTAINED_ROUTE_REPAIR_GUARDED_FETCH_FORBIDDEN_CAPABILITIES below for the
// one route-repair file whose repaired functionality is reaching the
// network instead.
const CONTAINED_ROUTE_REPAIR_FORBIDDEN_CAPABILITIES = Object.freeze(PURE_FORBIDDEN_CAPABILITIES.filter((name) => name !== 'database'));
// The SSRF-guarded fetch alone (from-url-fetch.js), split out of
// CONTAINED_ROUTE_REPAIR_SOURCES: `network` is the one capability permitted
// -- not `database`, which this file never touches at all, so inheriting
// the sibling class's allowance would be unjustified slack rather than a
// needed permission. See CONTAINED_ROUTE_REPAIR_GUARDED_FETCH_SOURCES in
// the inventory; the test below drives the real exported host-allowlist
// guard rather than trusting the capability name alone.
const CONTAINED_ROUTE_REPAIR_GUARDED_FETCH_FORBIDDEN_CAPABILITIES = Object.freeze(PURE_FORBIDDEN_CAPABILITIES.filter((name) => name !== 'network'));
// A PURE_PROPOSAL file that must verify (never produce) a submitted
// collector signature: same full boundary as PURE_PROPOSAL, minus the one
// capability (`signing`) crypto.verify/createPublicKey require. See
// PURE_PROPOSAL_SIGNATURE_VERIFICATION_SOURCES in the inventory;
// assertPureProposalSignatureVerificationBoundary below enforces the
// narrower verify-only shape, not just the bare capability name.
const PURE_PROPOSAL_SIGNATURE_VERIFICATION_FORBIDDEN_CAPABILITIES = Object.freeze(PURE_FORBIDDEN_CAPABILITIES.filter((name) => name !== 'signing'));
const ALLOWED_GIT_COMMANDS = Object.freeze(new Set([
  'cat-file', 'diff', 'diff-tree', 'log', 'ls-files', 'ls-tree',
  'rev-list', 'rev-parse', 'show', 'status',
]));
// The capability scan reads one file's own text, so it cannot see a capability
// reached through an import. A production-path pure analysis source therefore
// has to be a leaf: no dependencies at all, nothing to reach through.
const MODULE_DEPENDENCY_PATTERNS = Object.freeze([
  /\brequire\s*\(/g,
  /^\s*import\b/gm,
]);

function git(args, options = {}) {
  return childProcess.execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', options.ignoreErrors ? 'ignore' : 'pipe'],
  }).trim();
}

function lines(value) {
  return value.split('\n').map((entry) => entry.trim()).filter(Boolean);
}

function mechanicallyDerivedChangedProductionSources() {
  const tracked = lines(git(['diff', '--name-only', '--diff-filter=ACMR', PHASE1_BASE_COMMIT, '--', ...PRODUCTION_ROOTS]));
  const untracked = lines(git(['ls-files', '--others', '--exclude-standard', '--', ...PRODUCTION_ROOTS]));
  return [...new Set([...tracked, ...untracked])].filter((entry) => SOURCE_EXTENSION.test(entry)).sort();
}

function existedAtBase(relativePath) {
  const result = childProcess.spawnSync('git', ['cat-file', '-e', `${PHASE1_BASE_COMMIT}:${relativePath}`], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'ignore',
  });
  return result.status === 0;
}

function sourceAtBase(relativePath) {
  return git(['show', `${PHASE1_BASE_COMMIT}:${relativePath}`], { ignoreErrors: true });
}

// Resolves one file's capability surface and returns exact per-capability hit counts.
// Deliberately NOT lexically scoped -- every alias lives in one flat, whole-file table;
// see the "Coverage limits" note above the parser toolchain for why that is a conscious
// over-approximation. Throws (never returns zero counts) when the source cannot be
// parsed at all: an unreadable account of what a file does must never be read as "does
// nothing".
function capabilityCounts(source, filePath) {
  const program = parseCapabilitySource(source, filePath);
  if (!program) {
    throw new Error(`UNPARSEABLE_SOURCE: ${filePath || '(unknown source)'} could not be parsed as JavaScript/JSX by the capability scanner -- refusing to score it as capability-free.`);
  }

  const counts = Object.fromEntries(CAPABILITY_NAMES.map((name) => [name, 0]));
  const bump = (name) => { counts[name] += 1; };

  const valueTagOf = new Map(); // local name -> VALUE tag (module/global/client the name IS)
  const canonicalNameOf = new Map(); // local name -> the original imported/declared name it aliases
  const canonicalModuleOf = new Map(); // local name -> the module specifier it was bound from
  const callableReturnsTag = new Map(); // local function name -> VALUE tag its call result carries

  function resolveCanonicalCallee(node) {
    if (node.type === 'Identifier') return canonicalNameOf.get(node.name) || node.name;
    const memberName = staticMemberName(node);
    if (memberName !== null) return memberName;
    return null;
  }

  function resolveValueTag(node) {
    if (!node) return undefined;
    if (node.type === 'Identifier') {
      if (valueTagOf.has(node.name)) return valueTagOf.get(node.name);
      if (node.name === 'crypto') return 'CRYPTO'; // Web Crypto / Node global, no import required
      if (node.name === 'globalThis') return 'GLOBAL_THIS';
      if (HTTP_NAME_FALLBACK.has(node.name)) return 'HTTP_MODULE';
      if (FS_NAME_FALLBACK.has(node.name)) return 'FS_MODULE';
      return undefined;
    }
    if (node.type === 'MemberExpression') {
      const base = resolveValueTag(node.object);
      const prop = staticMemberName(node);
      if (prop === null) {
        if (base === 'HTTP_MODULE') return 'HTTP_CALLABLE';
        if (base === 'GLOBAL_THIS') return 'FETCH_CALLABLE';
        return undefined;
      }
      if (base === 'CRYPTO' && prop === 'subtle') return 'CRYPTO_SUBTLE';
      if (base === 'CRYPTO' && prop === 'webcrypto') return 'CRYPTO';
      if (base === 'FS_MODULE' && prop === 'promises') return 'FS_MODULE';
      if (base === 'HTTP_MODULE' && HTTP_METHODS.has(prop)) return 'HTTP_CALLABLE';
      if (base === 'GLOBAL_THIS' && prop === 'fetch') return 'FETCH_CALLABLE';
      return undefined;
    }
    if (node.type === 'CallExpression') {
      if (node.callee.type === 'Identifier' && node.callee.name === 'require'
        && node.arguments.length === 1 && node.arguments[0].type === 'Literal'
        && typeof node.arguments[0].value === 'string') {
        return NODE_BUILTIN_CAPABILITY_MODULES[node.arguments[0].value] || undefined;
      }
      const canonical = resolveCanonicalCallee(node.callee);
      if (canonical && DB_FACTORY_NAMES.has(canonical)) return 'DB_CLIENT';
      if (node.callee.type === 'Identifier' && callableReturnsTag.has(node.callee.name)) {
        return callableReturnsTag.get(node.callee.name);
      }
      return undefined;
    }
    return undefined;
  }

  function registerBinding(localName, sourceNode) {
    if (!localName || !sourceNode) return;
    const tag = resolveValueTag(sourceNode);
    if (tag) valueTagOf.set(localName, tag);
    if (sourceNode.type === 'Identifier') {
      canonicalNameOf.set(localName, canonicalNameOf.get(sourceNode.name) || sourceNode.name);
      const module = canonicalModuleOf.get(sourceNode.name);
      if (module) canonicalModuleOf.set(localName, module);
    }
  }

  function registerRequireOrImportBinding(localName, specifier, importedName) {
    if (!localName) return;
    const tag = NODE_BUILTIN_CAPABILITY_MODULES[specifier];
    if (tag) valueTagOf.set(localName, tag);
    canonicalModuleOf.set(localName, specifier);
    canonicalNameOf.set(localName, importedName || localName);
  }

  // Any AssignmentPattern default nested anywhere in a binding pattern -- covers both
  // `function f(x = y)` and the destructured-default shape that evaded the old scanner,
  // `function f({ x = y } = {})`.
  function registerPatternDefaults(pattern) {
    if (!pattern) return;
    if (pattern.type === 'AssignmentPattern') {
      if (pattern.left.type === 'Identifier') registerBinding(pattern.left.name, pattern.right);
      registerPatternDefaults(pattern.left);
      return;
    }
    if (pattern.type === 'ObjectPattern') {
      for (const prop of pattern.properties) {
        registerPatternDefaults(prop.type === 'RestElement' ? prop.argument : prop.value);
      }
      return;
    }
    if (pattern.type === 'ArrayPattern') {
      pattern.elements.forEach((element) => registerPatternDefaults(element));
      return;
    }
    if (pattern.type === 'RestElement') registerPatternDefaults(pattern.argument);
  }

  // Return-passthrough: a function whose body returns an already-resolved capability
  // value makes ITS OWN call result resolve to that same value -- e.g. `function
  // getSubtle() { ...; return crypto.subtle; }` makes `getSubtle()` resolve to
  // CRYPTO_SUBTLE, so `getSubtle().sign(...)` traces exactly like
  // `crypto.subtle.sign(...)`. Resolved in source order (see "Coverage limits" above):
  // a chain of wrapper functions resolves as long as each one is declared after what it
  // wraps; backward references and cycles are not traced.
  function registerReturnPassthrough(name, functionNode) {
    if (!name || !functionNode) return;
    let resolved;
    const inspect = (expr) => { if (!resolved && expr) resolved = resolveValueTag(expr); };
    if (functionNode.body && functionNode.body.type !== 'BlockStatement') {
      inspect(functionNode.body);
    } else if (functionNode.body) {
      walkCapabilityAst(functionNode.body, (node) => {
        if (node.type === 'ReturnStatement') inspect(node.argument);
        if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression'
          || node.type === 'ArrowFunctionExpression') return false; // don't cross into nested functions
        return undefined;
      });
    }
    if (resolved) callableReturnsTag.set(name, resolved);
  }

  const FUNCTION_EXPRESSION_TYPES = new Set(['FunctionExpression', 'ArrowFunctionExpression']);

  // Importing certain modules is ITSELF sufficient evidence, independent of whether any
  // method on the resulting binding is ever called -- matching the old scanner's own
  // design for these three specifiers (its `['"]node:https?['"]`, `['"]node:child_process
  // ['"]` and `@anthropic-ai\/sdk` patterns matched the bare specifier text with no call
  // required). `fs`/`crypto`/Supabase imports are NOT in this set: the old scanner never
  // treated importing them alone as sufficient either, only actually calling a write/sign/
  // db method -- preserved here rather than invented, so this stays a closed hole, not a
  // wider net.
  function bumpForModuleSpecifier(specifier) {
    if (isAnthropicSdkSpecifier(specifier)) bump('provider');
    const tag = NODE_BUILTIN_CAPABILITY_MODULES[specifier];
    if (tag === 'HTTP_MODULE') bump('network');
    if (tag === 'CHILD_PROCESS_MODULE') bump('external_process');
  }

  walkCapabilityAst(program, (node) => {
    if (node.type === 'ImportDeclaration' && node.source && typeof node.source.value === 'string') {
      const specifier = node.source.value;
      bumpForModuleSpecifier(specifier);
      for (const spec of node.specifiers) {
        if (spec.type === 'ImportSpecifier') {
          const importedName = spec.imported.name || spec.imported.value;
          registerRequireOrImportBinding(spec.local.name, specifier, importedName);
        } else {
          registerRequireOrImportBinding(spec.local.name, specifier, null);
        }
      }
      return undefined;
    }

    if (node.type === 'VariableDeclarator' && node.init) {
      const { init } = node;
      const isRequireCall = init.type === 'CallExpression' && init.callee.type === 'Identifier'
        && init.callee.name === 'require' && init.arguments.length === 1
        && init.arguments[0].type === 'Literal' && typeof init.arguments[0].value === 'string';
      if (isRequireCall) {
        const specifier = init.arguments[0].value;
        bumpForModuleSpecifier(specifier);
        if (node.id.type === 'Identifier') {
          registerRequireOrImportBinding(node.id.name, specifier, null);
        } else if (node.id.type === 'ObjectPattern') {
          for (const prop of node.id.properties) {
            if (prop.type !== 'Property' || prop.computed) continue;
            const importedName = prop.key.type === 'Identifier' ? prop.key.name : prop.key.value;
            const valueNode = prop.value.type === 'AssignmentPattern' ? prop.value.left : prop.value;
            if (valueNode.type === 'Identifier') registerRequireOrImportBinding(valueNode.name, specifier, importedName);
          }
        }
      } else if (node.id.type === 'Identifier') {
        registerBinding(node.id.name, init);
        if (FUNCTION_EXPRESSION_TYPES.has(init.type)) registerReturnPassthrough(node.id.name, init);
      }
      registerPatternDefaults(node.id);
      return undefined;
    }

    if (node.type === 'FunctionDeclaration') {
      node.params.forEach((param) => registerPatternDefaults(param));
      if (node.id) registerReturnPassthrough(node.id.name, node);
      return undefined;
    }
    if (node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') {
      node.params.forEach((param) => registerPatternDefaults(param));
      return undefined;
    }

    if (node.type === 'Literal' && typeof node.value === 'string') {
      if (SQL_PHRASE.test(node.value)) bump('database');
      if (VERCEL_DEPLOY_PHRASE.test(node.value)) bump('deployment_or_activation');
      return undefined;
    }
    if (node.type === 'TemplateElement') {
      const text = (node.value && (node.value.cooked || node.value.raw)) || '';
      if (SQL_PHRASE.test(text)) bump('database');
      if (VERCEL_DEPLOY_PHRASE.test(text)) bump('deployment_or_activation');
      return undefined;
    }

    if (node.type === 'CallExpression') {
      const { callee } = node;
      // One call site is one hit, even when more than one rule below independently
      // recognizes it (e.g. `crypto.createPrivateKey(...)` matches both the any-receiver
      // name check and the CRYPTO-tagged-receiver method check) -- collect, then bump each
      // capability at most once for this node.
      const hits = new Set();
      if (callee.type === 'Identifier' && callee.name === 'fetch') hits.add('network');

      const canonical = resolveCanonicalCallee(callee);
      if (canonical) {
        if (DB_FACTORY_NAMES.has(canonical)) hits.add('database');
        if (PROVIDER_ANY_RECEIVER_NAMES.has(canonical)) hits.add('provider');
        if (DEPLOYMENT_ANY_RECEIVER_NAMES.has(canonical)) hits.add('deployment_or_activation');
        if (CRYPTO_ANY_RECEIVER_NAMES.has(canonical)) hits.add('signing');
      }

      if (callee.type === 'Identifier') {
        const resolvedBareName = canonicalNameOf.get(callee.name) || callee.name;
        const callableTag = resolveValueTag(callee);
        if (callableTag === 'HTTP_CALLABLE' || callableTag === 'FETCH_CALLABLE') hits.add('network');
        if (FS_WRITE_METHODS.has(resolvedBareName)) hits.add('filesystem_write');
        if (CHILD_PROCESS_METHODS.has(resolvedBareName)) hits.add('external_process');
        const boundModule = canonicalModuleOf.get(callee.name);
        if ((resolvedBareName === 'sign' || resolvedBareName === 'verify')
          && (boundModule === 'crypto' || boundModule === 'node:crypto')) {
          hits.add('signing');
        }
      }

      if (callee.type === 'MemberExpression') {
        const propName = staticMemberName(callee);
        const baseTag = resolveValueTag(callee.object);
        const objectName = callee.object.type === 'Identifier' ? callee.object.name : null;
        if (baseTag === 'GLOBAL_THIS' && (propName === 'fetch' || propName === null)) hits.add('network');
        if ((baseTag === 'HTTP_MODULE' || (objectName && HTTP_NAME_FALLBACK.has(objectName)))
            && (propName === null || HTTP_METHODS.has(propName))) {
          hits.add('network');
        }
        if ((baseTag === 'CRYPTO' || baseTag === 'CRYPTO_SUBTLE' || objectName === 'crypto') && CRYPTO_MEMBER_METHODS.has(propName)) {
          hits.add('signing');
        }
        if ((baseTag === 'FS_MODULE' || (objectName && FS_NAME_FALLBACK.has(objectName))) && FS_WRITE_METHODS.has(propName)) {
          hits.add('filesystem_write');
        }
        if (baseTag === 'CHILD_PROCESS_MODULE' && CHILD_PROCESS_METHODS.has(propName)) {
          hits.add('external_process');
        }
        if ((baseTag === 'DB_CLIENT' || (objectName && DB_NAME_FALLBACK.has(objectName))) && DB_CLIENT_METHODS.has(propName)) {
          hits.add('database');
        }
      }
      const gitArgv = callee.type === 'Identifier' && callee.name === 'gitText'
        ? node.arguments[0]
        : callee.type === 'Identifier' && callee.name === 'git'
          ? node.arguments[1]
          : callee.type === 'Identifier' && callee.name === 'execFileSync'
            && node.arguments[0]?.type === 'Literal' && node.arguments[0].value === 'git'
            ? node.arguments[1]
            : null;
      if (gitArgv?.type === 'ArrayExpression'
          && gitArgv.elements[0]?.type === 'Literal'
          && gitArgv.elements[0].value === 'ls-remote') hits.add('network');
      hits.forEach(bump);
      return undefined;
    }
    return undefined;
  });

  return counts;
}

function assertNoCapabilities(source, forbiddenCapabilities, label) {
  const counts = capabilityCounts(source, label);
  const present = forbiddenCapabilities.filter((name) => counts[name] > 0);
  assert.deepEqual(present, [], `${label} has forbidden capabilities: ${present.join(', ')}`);
}

function assertNoModuleDependencies(source, label) {
  const found = MODULE_DEPENDENCY_PATTERNS.reduce((count, pattern) => count + (source.match(pattern) || []).length, 0);
  assert.equal(found, 0, `${label} must declare no module dependencies: purity resting on an import is purity the capability scan never checked`);
}

function assertNoCapabilityGrowth(baseSource, currentSource, label) {
  const before = capabilityCounts(baseSource, label);
  const after = capabilityCounts(currentSource, label);
  const growth = Object.keys(after).filter((name) => after[name] > before[name]);
  assert.deepEqual(growth, [], `${label} adds capabilities: ${growth.join(', ')}`);
}

function staticArgumentDescriptor(node, label) {
  assert.ok(node, `${label} argument must exist`);
  assert.notEqual(node.type, 'SpreadElement', `${label} argv must not contain a spread`);
  if (node.type === 'Literal') return node.value;
  if (node.type === 'Identifier') return `$${node.name}`;
  if (node.type === 'TemplateLiteral') {
    const parts = [node.quasis[0].value.cooked];
    for (let index = 0; index < node.expressions.length; index += 1) {
      const expression = node.expressions[index];
      assert.equal(expression.type, 'Identifier', `${label} template interpolation must be a named binding`);
      parts.push('${$' + expression.name + '}', node.quasis[index + 1].value.cooked);
    }
    return `\`${parts.join('')}\``;
  }
  if (node.type === 'MemberExpression' && node.object.type === 'Identifier') {
    const property = staticMemberName(node);
    if (property !== null) return `$${node.object.name}.${property}`;
  }
  assert.fail(`${label} argv must contain only static literals or named bindings`);
}

function staticArgvDescriptor(node, label) {
  assert.equal(node?.type, 'ArrayExpression', `${label} argv must be a literal array`);
  return node.elements.map((element, index) => staticArgumentDescriptor(element, `${label}[${index}]`));
}

function collectCapabilityNodes(program, predicate) {
  const selected = [];
  walkCapabilityAst(program, (node) => {
    if (predicate(node)) selected.push(node);
    return undefined;
  });
  return selected;
}

function bindingInitializer(program, name, label) {
  const declarations = collectCapabilityNodes(
    program,
    (node) => node.type === 'VariableDeclarator'
      && node.id.type === 'Identifier' && node.id.name === name,
  );
  assert.equal(declarations.length, 1, `${label} must declare ${name} exactly once`);
  return declarations[0].init;
}

function assertLiteralBinding(program, name, expected, label) {
  const initializer = bindingInitializer(program, name, label);
  assert.equal(initializer?.type, 'Literal', `${label} ${name} must be a literal`);
  assert.equal(initializer.value, expected, `${label} ${name} must remain pinned`);
  const declarations = collectCapabilityNodes(
    program,
    (node) => node.type === 'VariableDeclaration'
      && node.declarations.some((declaration) => declaration.id.type === 'Identifier'
        && declaration.id.name === name),
  );
  assert.equal(declarations.length, 1, `${label} ${name} declaration must be unique`);
  assert.equal(declarations[0].kind, 'const', `${label} ${name} must be immutable`);
  const mutations = collectCapabilityNodes(
    program,
    (node) => {
      const target = node.type === 'AssignmentExpression' ? node.left
        : node.type === 'UpdateExpression' ? node.argument : null;
      return target?.type === 'Identifier' && target.name === name;
    },
  );
  assert.equal(mutations.length, 0, `${label} ${name} must never be reassigned`);
}

function assertStaticConstBinding(program, name, expected, label) {
  const initializer = bindingInitializer(program, name, label);
  assert.equal(
    staticArgumentDescriptor(initializer, `${label} ${name}`),
    expected,
    `${label} ${name} must remain pinned`,
  );
  const declarations = collectCapabilityNodes(
    program,
    (node) => node.type === 'VariableDeclaration'
      && node.declarations.some((declaration) => declaration.id.type === 'Identifier'
        && declaration.id.name === name),
  );
  assert.equal(declarations.length, 1, `${label} ${name} declaration must be unique`);
  assert.equal(declarations[0].kind, 'const', `${label} ${name} must be immutable`);
  assertIdentifierNeverReassigned(program, name, label);
}

function assertIdentifierNeverReassigned(program, name, label) {
  const mutations = collectCapabilityNodes(
    program,
    (node) => {
      const target = node.type === 'AssignmentExpression' ? node.left
        : node.type === 'UpdateExpression' ? node.argument : null;
      return target?.type === 'Identifier' && target.name === name;
    },
  );
  assert.equal(mutations.length, 0, `${label} ${name} must never be reassigned`);
}

function assertIdentifierReferenceCount(program, name, expected, label) {
  const references = collectCapabilityNodes(
    program,
    (node) => node.type === 'Identifier' && node.name === name,
  );
  assert.equal(
    references.length,
    expected,
    `${label} ${name} reference count must be exact`,
  );
}

function assertExactNamedImport(program, moduleName, importedName, localName, label) {
  const imports = collectCapabilityNodes(
    program,
    (node) => node.type === 'ImportDeclaration' && node.source?.value === moduleName,
  );
  assert.equal(imports.length, 1, `${label} must import ${moduleName} exactly once`);
  assert.equal(imports[0].specifiers.length, 1, `${label} ${moduleName} import must be exact`);
  const specifier = imports[0].specifiers[0];
  assert.equal(specifier.type, 'ImportSpecifier', `${label} ${moduleName} import must be named`);
  assert.equal(specifier.imported.name, importedName, `${label} imported name drift`);
  assert.equal(specifier.local.name, localName, `${label} imported name must not be aliased`);
}

function assertExactNamedImportRoster(program, moduleName, expected, label) {
  const imports = collectCapabilityNodes(
    program,
    (node) => node.type === 'ImportDeclaration' && node.source?.value === moduleName,
  );
  assert.equal(imports.length, 1, `${label} must import ${moduleName} exactly once`);
  assert.deepEqual(
    imports[0].specifiers.map((specifier) => {
      assert.equal(specifier.type, 'ImportSpecifier', `${label} ${moduleName} import must be named`);
      return [specifier.imported.name || specifier.imported.value, specifier.local.name];
    }),
    expected.map((binding) => [...binding]),
    `${label} ${moduleName} import must be exact`,
  );
}

function assertExactFileSystemImportRoster(program, expected, label) {
  const fileSystemImports = collectCapabilityNodes(
    program,
    (node) => node.type === 'ImportDeclaration'
      && NODE_BUILTIN_CAPABILITY_MODULES[node.source?.value] === 'FS_MODULE',
  );
  const fileSystemDynamicImports = collectCapabilityNodes(
    program,
    (node) => node.type === 'ImportExpression'
      && NODE_BUILTIN_CAPABILITY_MODULES[node.source?.value] === 'FS_MODULE',
  );
  const fileSystemRequires = collectCapabilityNodes(
    program,
    (node) => node.type === 'CallExpression'
      && node.callee.type === 'Identifier' && node.callee.name === 'require'
      && node.arguments.length === 1
      && NODE_BUILTIN_CAPABILITY_MODULES[node.arguments[0]?.value] === 'FS_MODULE',
  );
  assert.equal(
    fileSystemImports.length + fileSystemDynamicImports.length + fileSystemRequires.length,
    1,
    `${label} node:fs import must be exact across all file-system module variants`,
  );
  assert.equal(
    fileSystemImports[0]?.source.value,
    'node:fs',
    `${label} node:fs import must be the only file-system module dependency`,
  );
  assertExactNamedImportRoster(program, 'node:fs', expected, label);
}

function assertExactDefaultImport(program, moduleName, localName, label) {
  const imports = collectCapabilityNodes(
    program,
    (node) => node.type === 'ImportDeclaration' && node.source?.value === moduleName,
  );
  assert.equal(imports.length, 1, `${label} must import ${moduleName} exactly once`);
  assert.equal(imports[0].specifiers.length, 1, `${label} ${moduleName} import must be exact`);
  assert.equal(imports[0].specifiers[0].type, 'ImportDefaultSpecifier', `${label} ${moduleName} import must be default`);
  assert.equal(imports[0].specifiers[0].local.name, localName, `${label} ${moduleName} import must not be aliased`);
}

function extractedGitCommands(source) {
  const commands = [];
  const patterns = [
    /\b(?:git|gitText)\(\s*[^,]+,\s*\[\s*['"]([^'"]+)['"]/g,
    /\bexecFileSync\(\s*['"]git['"]\s*,\s*\[\s*['"]([^'"]+)['"]/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      if (match[1] !== '-C') commands.push(match[1]);
    }
  }
  return commands;
}

function assertLiteralGitHelperCommands(source, label, allowedCommands = ALLOWED_GIT_COMMANDS) {
  const program = parseCapabilitySource(source, label);
  if (!program) throw new Error(`UNPARSEABLE_SOURCE: ${label}`);
  walkCapabilityAst(program, (node) => {
    if (node.type !== 'CallExpression' || node.callee.type !== 'Identifier'
        || !['git', 'gitText'].includes(node.callee.name)) return undefined;
    const argv = node.callee.name === 'gitText' && node.arguments[0]?.type === 'ArrayExpression'
      ? node.arguments[0]
      : node.arguments[1];
    const staticArgv = staticArgvDescriptor(argv, `${label} Git helper`);
    assert.ok(allowedCommands.has(staticArgv[0]), `${label} contains a non-read-only Git command`);
    return undefined;
  });
}

function assertReadOnlyGitCommands(source, label) {
  const processLaunches = source.match(/\bexecFileSync\s*\(/g) || [];
  const gitLaunches = source.match(/\b(?:[A-Za-z_$][\w$]*\.)?execFileSync\(\s*['"]git['"]/g) || [];
  assert.equal(processLaunches.length, gitLaunches.length, `${label} may launch only the Git executable`);
  assert.ok(processLaunches.length > 0, `${label} must contain an explicit Git inspection`);
  const commands = extractedGitCommands(source);
  assert.ok(commands.length > 0, `${label} must declare Git commands as literal array heads`);
  assert.deepEqual(commands.filter((command) => !ALLOWED_GIT_COMMANDS.has(command)), [], `${label} contains a non-read-only Git command`);
  assertLiteralGitHelperCommands(source, label);
}

function assertLiteralExecFileGitCommands(source, label) {
  const program = parseCapabilitySource(source, label);
  const imports = [];
  const requireCalls = [];
  const requireBindings = [];
  const isChildProcessSpecifier = (value) => ['child_process', 'node:child_process'].includes(value);
  walkCapabilityAst(program, (node) => {
    if (node.type === 'ImportDeclaration'
        && isChildProcessSpecifier(node.source?.value)) imports.push(node);
    if (node.type === 'CallExpression'
        && node.callee.type === 'Identifier' && node.callee.name === 'require'
        && node.arguments.length === 1 && node.arguments[0].type === 'Literal'
        && isChildProcessSpecifier(node.arguments[0].value)) requireCalls.push(node);
    if (node.type === 'VariableDeclaration') {
      for (const declaration of node.declarations) {
        if (declaration.init?.type === 'CallExpression'
            && declaration.init.callee.type === 'Identifier' && declaration.init.callee.name === 'require'
            && declaration.init.arguments.length === 1 && declaration.init.arguments[0].type === 'Literal'
            && isChildProcessSpecifier(declaration.init.arguments[0].value)) {
          requireBindings.push({ declaration, statement: node });
        }
      }
    }
    return undefined;
  });
  assert.equal(imports.length + requireCalls.length, 1, `${label} must import child-process authority exactly once`);
  if (imports.length === 1) {
    assert.equal(imports[0].source.value, 'node:child_process', `${label} must use the node:child_process specifier`);
    assert.equal(imports[0].specifiers.length, 1, `${label} may import only execFileSync from node:child_process`);
    assert.equal(imports[0].specifiers[0].type, 'ImportSpecifier', `${label} may import only execFileSync from node:child_process`);
    assert.equal(imports[0].specifiers[0].imported.name, 'execFileSync', `${label} may import only execFileSync from node:child_process`);
    assert.equal(imports[0].specifiers[0].local.name, 'execFileSync', `${label} may not alias execFileSync`);
  } else {
    assert.equal(requireCalls[0].arguments[0].value, 'node:child_process', `${label} must use the node:child_process specifier`);
    assert.equal(requireBindings.length, 1, `${label} must bind its child-process authority exactly once`);
    const { declaration, statement } = requireBindings[0];
    assert.equal(statement.kind, 'const', `${label} child-process authority binding must be const`);
    assert.equal(statement.declarations.length, 1, `${label} child-process authority binding must be isolated`);
    assert.equal(declaration.id.type, 'ObjectPattern', `${label} may import only execFileSync from node:child_process`);
    assert.equal(declaration.id.properties.length, 1, `${label} may import only execFileSync from node:child_process`);
    const [property] = declaration.id.properties;
    assert.equal(property.type, 'Property', `${label} may import only execFileSync from node:child_process`);
    assert.equal(property.computed, false, `${label} may import only execFileSync from node:child_process`);
    assert.equal(property.key.name, 'execFileSync', `${label} may import only execFileSync from node:child_process`);
    assert.equal(property.value.name, 'execFileSync', `${label} may not alias execFileSync`);
  }
  const processLaunches = source.match(/\b(?:execFileSync|execSync|spawnSync|spawn)\s*\(/g) || [];
  const gitLaunches = source.match(/\bexecFileSync\(\s*['"]git['"]/g) || [];
  assert.equal(processLaunches.length, gitLaunches.length, `${label} may launch only the Git executable`);
  assert.equal(
    capabilityCounts(source, label).external_process,
    gitLaunches.length + 1,
    `${label} may use child-process authority only for its literal Git launches`,
  );
  assert.ok(processLaunches.length > 0, `${label} must contain an explicit Git inspection`);
  const commands = extractedGitCommands(source);
  assert.ok(commands.length > 0, `${label} must declare Git commands as literal array heads`);
  assert.deepEqual(commands.filter((command) => !ALLOWED_GIT_COMMANDS.has(command)), [], `${label} contains a non-read-only Git command`);
}

function assertReadOnlyGitInspector(source, label) {
  assertNoCapabilities(source, GIT_INSPECTOR_FORBIDDEN_CAPABILITIES, label);
  assertReadOnlyGitCommands(source, label);
}

function assertReadOnlyGitArtifactWriter(source, label) {
  assertNoCapabilities(source, GIT_ARTIFACT_WRITER_FORBIDDEN_CAPABILITIES, label);
  const counts = capabilityCounts(source, label);
  assert.ok(counts.external_process > 0, `${label} must inspect Git through an external process`);
  assert.ok(counts.filesystem_write > 0, `${label} must write only local evidence`);
  assertLiteralExecFileGitCommands(source, label);
}

function assertExactGitReadBoundary(program, label, rootName, expectedCalls) {
  assertExactNamedImport(
    program,
    'node:child_process',
    'execFileSync',
    'execFileSync',
    label,
  );
  const gitWrapper = uniqueFunctionDeclaration(program, 'gitRead', label);
  assert.deepEqual(
    gitWrapper.params.map((parameter) => parameter.type === 'Identifier' ? parameter.name : null),
    [rootName, 'argv'],
    `${label} Git reader parameters must be exact`,
  );
  const gitLaunches = collectCapabilityNodes(
    program,
    (node) => node.type === 'CallExpression'
      && node.callee.type === 'Identifier' && node.callee.name === 'execFileSync',
  );
  assert.equal(gitLaunches.length, 1, `${label} Git reader must be the only process launch`);
  assert.equal(
    collectCapabilityNodes(
      gitWrapper,
      (node) => node.type === 'CallExpression'
        && node.callee.type === 'Identifier' && node.callee.name === 'execFileSync',
    )[0],
    gitLaunches[0],
    `${label} process launch must remain inside the Git reader`,
  );
  assert.equal(gitLaunches[0].arguments.length, 3, `${label} Git launch must be exact`);
  assert.equal(gitLaunches[0].arguments[0].type, 'Literal');
  assert.equal(gitLaunches[0].arguments[0].value, 'git', `${label} may launch only Git`);
  assert.equal(gitLaunches[0].arguments[1].type, 'Identifier');
  assert.equal(gitLaunches[0].arguments[1].name, 'argv', `${label} Git argv must use the checked parameter`);
  const gitOptions = gitLaunches[0].arguments[2];
  assert.equal(gitOptions.type, 'ObjectExpression', `${label} Git options must be literal`);
  const gitOptionProperties = new Map(gitOptions.properties.map((property) => {
    assert.equal(property.type, 'Property', `${label} Git option must be static`);
    assert.equal(property.computed, false, `${label} Git option key must be static`);
    return [property.key.name ?? property.key.value, property.value];
  }));
  assert.deepEqual(
    [...gitOptionProperties.keys()],
    ['cwd', 'encoding', 'env', 'maxBuffer', 'stdio'],
    `${label} Git options must be exact`,
  );
  assert.equal(
    staticArgumentDescriptor(gitOptionProperties.get('cwd'), label),
    `$${rootName}`,
  );
  assert.equal(staticArgumentDescriptor(gitOptionProperties.get('encoding'), label), 'utf8');
  assert.equal(staticArgumentDescriptor(gitOptionProperties.get('env'), label), '$environment');
  assert.deepEqual(
    staticExpressionDescriptor(gitOptionProperties.get('maxBuffer'), label),
    ['*', ['*', 64, 1024], 1024],
  );
  assert.deepEqual(staticArgvDescriptor(gitOptionProperties.get('stdio'), label), [
    'ignore', 'pipe', 'pipe',
  ]);

  const gitReadCalls = collectCapabilityNodes(
    program,
    (node) => node.type === 'CallExpression'
      && node.callee.type === 'Identifier' && node.callee.name === 'gitRead',
  );
  assert.deepEqual(
    gitReadCalls.map((call, index) => {
      assert.equal(call.arguments.length, 2, `${label} Git read ${index + 1} must be exact`);
      assert.equal(
        staticArgumentDescriptor(call.arguments[0], `${label} Git read ${index + 1}`),
        `$${rootName}`,
      );
      return runnerArgvDescriptor(call.arguments[1], `${label} Git read ${index + 1}`);
    }),
    expectedCalls,
    `${label} may run only the exact pushed-tree inspection set`,
  );
}

// The execution-manifest validator holds no child-process authority of its own:
// its fixed pushed-tree inspection is delegated, call by literal call, to the
// Work3 validator's exported read-only seam. This asserts the delegation is
// exact: the seam is the only Git reader it imports, nothing launches a process
// here, and the inspection set is the same literal set the in-file reader used.
function assertDelegatedGitReadBoundary(program, label, rootName, readerName, expectedCalls) {
  assert.equal(
    collectCapabilityNodes(
      program,
      (node) => node.type === 'ImportDeclaration'
        && ['child_process', 'node:child_process'].includes(node.source?.value),
    ).length,
    0,
    `${label} may not import child-process authority`,
  );
  assert.equal(
    collectCapabilityNodes(
      program,
      (node) => node.type === 'CallExpression'
        && node.callee.type === 'Identifier'
        && ['execFileSync', 'execSync', 'spawnSync', 'spawn'].includes(node.callee.name),
    ).length,
    0,
    `${label} may not launch a process`,
  );
  assert.equal(
    collectCapabilityNodes(
      program,
      (node) => node.type === 'FunctionDeclaration' && node.id?.name === readerName,
    ).length,
    0,
    `${label} may not define its own ${readerName}`,
  );
  const gitReadCalls = collectCapabilityNodes(
    program,
    (node) => node.type === 'CallExpression'
      && node.callee.type === 'Identifier' && node.callee.name === readerName,
  );
  assert.deepEqual(
    gitReadCalls.map((call, index) => {
      assert.equal(call.arguments.length, 2, `${label} Git read ${index + 1} must be exact`);
      assert.equal(
        staticArgumentDescriptor(call.arguments[0], `${label} Git read ${index + 1}`),
        `$${rootName}`,
      );
      return runnerArgvDescriptor(call.arguments[1], `${label} Git read ${index + 1}`);
    }),
    expectedCalls,
    `${label} may run only the exact pushed-tree inspection set`,
  );
}

function assertExecutionManifestValidatorGitBoundary(source, label) {
  assertNoCapabilities(source, PURE_FORBIDDEN_CAPABILITIES, label);
  const program = parseCapabilitySource(source, label);
  assertExactNamedImportRoster(
    program,
    './stage-2y-structure-m7-v2-repair-work3-validate.mjs',
    [['gitReadText', 'gitReadText'], ['validateWork3', 'validateWork3']],
    label,
  );
  assertDelegatedGitReadBoundary(program, label, 'root', 'gitReadText', [
    ['cat-file', '-e', '`${$binding.commit}^{commit}`'],
    ['merge-base', '--is-ancestor', '$WORK3_V2_FINAL_COMMIT', '$binding.commit'],
    ['rev-parse', '`refs/remotes/origin/${$BRANCH}`'],
    ['merge-base', '--is-ancestor', '$binding.commit', '$originCommit'],
    ['rev-list', '--parents', '-n', '1', '$binding.commit'],
    ['log', '--format=%s', '-n', '1', '$binding.commit'],
    ['diff-tree', '--no-commit-id', '--name-only', '-r', '$binding.commit'],
    ['ls-tree', '-r', '--full-tree', '$binding.commit', '--', '$predecessorReceiptBinding.path'],
  ]);
}

function assertWork4CandidateBinderBoundary(source, label) {
  assertNoCapabilities(source, GIT_ARTIFACT_WRITER_FORBIDDEN_CAPABILITIES, label);
  const counts = capabilityCounts(source, label);
  assert.ok(counts.external_process > 0, `${label} must inspect the pushed Git tree`);
  assert.ok(counts.filesystem_write > 0, `${label} must write its governed local outputs`);
  const program = parseCapabilitySource(source, label);
  assertExactNamedImport(
    program,
    './stage-2y-structure-m7-v2-repair-work3-validate.mjs',
    'validateWork3',
    'validateWork3',
    label,
  );
  assertExactNamedImport(
    program,
    './stage-2y-structure-m7-v2-repair-register-candidate.mjs',
    'registerCandidate',
    'registerCandidate',
    label,
  );
  assertLiteralBinding(
    program,
    'WORK3_COMMIT',
    'a0df3f8621107481144e5be1429466d8b193f9be',
    label,
  );
  assertLiteralBinding(
    program,
    'MIGRATION_ROOT',
    'evidence/canonical-v2/stage-2y-structure-migration',
    label,
  );
  assertStaticConstBinding(program, 'CONTROL_ROOT', '`${$MIGRATION_ROOT}/control`', label);
  assertStaticConstBinding(
    program,
    'MANIFEST_PATH',
    '`${$CONTROL_ROOT}/m7-v2-repair-work4-execution-manifest.json`',
    label,
  );
  assertStaticConstBinding(
    program,
    'TRANSITION_AUTHORITY_PATH',
    '`${$CONTROL_ROOT}/m7-v2-repair-work4-candidate-transition-authority.json`',
    label,
  );

  assertExactGitReadBoundary(program, label, 'repoRoot', [
    ['rev-parse', 'HEAD'],
    ['rev-parse', '$ORIGIN_REF'],
    ['symbolic-ref', '--short', 'HEAD'],
    ['merge-base', '--is-ancestor', '$WORK3_COMMIT', '$head'],
    ['rev-list', '--parents', '-n', '1', '$head'],
    ['log', '--format=%s', '-n', '1', '$head'],
    ['diff-tree', '--no-commit-id', '--name-only', '-r', '$head'],
    ['ls-tree', '-r', '--full-tree', '$head', '--', '$predecessorReceiptBinding.path'],
    ['ls-tree', '-rz', '--full-tree', '$head', '--', '...$requiredInputPaths'],
  ]);

  const work3Calls = collectCapabilityNodes(
    program,
    (node) => node.type === 'CallExpression'
      && node.callee.type === 'Identifier' && node.callee.name === 'validateWork3',
  );
  assert.equal(work3Calls.length, 1, `${label} must validate the pinned Work3 tree once`);
  assert.deepEqual(
    staticObjectDescriptor(work3Calls[0].arguments[0], `${label} Work3 validation`),
    [['repoRoot', '$repoRoot'], ['sourceCommit', '$WORK3_COMMIT']],
    `${label} Work3 validation must use the exact pinned commit`,
  );

  const registrationCalls = collectCapabilityNodes(
    program,
    (node) => node.type === 'CallExpression'
      && node.callee.type === 'Identifier' && node.callee.name === 'registerCandidate',
  );
  assert.equal(registrationCalls.length, 2, `${label} candidate writer call set must be exact`);
  const registrationWriteModes = new Map(registrationCalls.map((call, index) => {
    assert.equal(call.arguments.length, 1, `${label} candidate call ${index + 1} must be exact`);
    const options = call.arguments[0];
    assert.equal(options?.type, 'ObjectExpression', `${label} candidate options must be literal`);
    const properties = new Map(options.properties.map((property) => {
      assert.equal(property.type, 'Property', `${label} candidate option must be static`);
      assert.equal(property.computed, false, `${label} candidate option key must be static`);
      return [property.key.name ?? property.key.value, property.value];
    }));
    assert.deepEqual([...properties.keys()], ['repoRoot', 'specification', 'write']);
    assert.equal(
      staticArgumentDescriptor(properties.get('repoRoot'), `${label} candidate repoRoot`),
      '$repoRoot',
    );
    const specification = properties.get('specification');
    assert.equal(specification?.type, 'CallExpression', `${label} candidate specification must be built`);
    assert.equal(specification.callee?.type, 'Identifier');
    assert.equal(specification.callee.name, 'buildCandidateSpecification');
    assert.equal(specification.arguments.length, 1);
    assert.deepEqual(
      staticObjectDescriptor(specification.arguments[0], `${label} candidate specification`),
      [['repoRoot', '$repoRoot']],
    );
    assert.equal(properties.get('write')?.type, 'Literal');
    return [call, properties.get('write').value];
  }));
  assert.deepEqual(
    [...registrationWriteModes.values()],
    [false, true],
    `${label} must preview once and write once`,
  );

  const previewFunction = uniqueFunctionDeclaration(program, 'previewWork4Candidate', label);
  const bootstrapFunction = uniqueFunctionDeclaration(
    program,
    'writeWork4BootstrapManifest',
    label,
  );
  const transitionFunction = uniqueFunctionDeclaration(program, 'transitionWork4Candidate', label);
  const previewRegistrations = collectCapabilityNodes(
    previewFunction,
    (node) => registrationWriteModes.has(node),
  );
  const transitionRegistrations = collectCapabilityNodes(
    transitionFunction,
    (node) => registrationWriteModes.has(node),
  );
  assert.deepEqual(
    previewRegistrations.map((call) => registrationWriteModes.get(call)),
    [false],
    `${label} preview must remain non-writing`,
  );
  assert.deepEqual(
    transitionRegistrations.map((call) => registrationWriteModes.get(call)),
    [true],
    `${label} transition must write exactly one registration`,
  );

  const bootstrapWrites = collectCapabilityNodes(
    bootstrapFunction,
    (node) => node.type === 'CallExpression'
      && node.callee.type === 'Identifier' && node.callee.name === 'writeExclusive',
  );
  assert.equal(bootstrapWrites.length, 1, `${label} bootstrap write set must be exact`);
  assert.deepEqual(
    bootstrapWrites[0].arguments.slice(0, 2).map((argument) => staticArgumentDescriptor(
      argument,
      `${label} bootstrap write`,
    )),
    ['$repoRoot', '$MANIFEST_PATH'],
    `${label} bootstrap may write only the manifest`,
  );
  const bootstrapBytes = bootstrapWrites[0].arguments[2];
  assert.equal(bootstrapBytes?.type, 'CallExpression', `${label} bootstrap bytes must be canonical`);
  assert.equal(bootstrapBytes.callee?.type, 'Identifier');
  assert.equal(bootstrapBytes.callee.name, 'canonicalBytes');
  assert.deepEqual(
    bootstrapBytes.arguments.map((argument) => staticArgumentDescriptor(
      argument,
      `${label} bootstrap bytes`,
    )),
    ['$manifest'],
  );

  const transitionWrites = collectCapabilityNodes(
    transitionFunction,
    (node) => node.type === 'CallExpression'
      && node.callee.type === 'Identifier'
      && ['writeExclusive', 'replaceManifest'].includes(node.callee.name),
  );
  assert.deepEqual(
    transitionWrites.map((call) => [
      call.callee.name,
      call.arguments.map((argument) => staticArgumentDescriptor(
        argument,
        `${label} transition ${call.callee.name}`,
      )),
    ]),
    [
      ['writeExclusive', ['$repoRoot', '$TRANSITION_AUTHORITY_PATH', '$transitionBytes']],
      ['replaceManifest', ['$repoRoot', '$manifest']],
    ],
    `${label} transition write set must remain exact`,
  );
  const allGovernedWrites = collectCapabilityNodes(
    program,
    (node) => node.type === 'CallExpression'
      && node.callee.type === 'Identifier'
      && ['writeExclusive', 'replaceManifest'].includes(node.callee.name),
  );
  assert.equal(
    allGovernedWrites.length,
    bootstrapWrites.length + transitionWrites.length,
    `${label} may invoke governed writers only from bootstrap and transition`,
  );

  const directWrites = collectCapabilityNodes(
    program,
    (node) => node.type === 'CallExpression'
      && node.callee.type === 'MemberExpression'
      && node.callee.object.type === 'Identifier'
      && node.callee.object.name === 'fs'
      && FS_WRITE_METHODS.has(staticMemberName(node.callee)),
  );
  const governedWriters = ['writeExclusive', 'replaceManifest']
    .map((name) => uniqueFunctionDeclaration(program, name, label));
  const governedDirectWrites = governedWriters.flatMap((writer) => collectCapabilityNodes(
    writer,
    (node) => node.type === 'CallExpression'
      && node.callee.type === 'MemberExpression'
      && node.callee.object.type === 'Identifier'
      && node.callee.object.name === 'fs'
      && FS_WRITE_METHODS.has(staticMemberName(node.callee)),
  ));
  assert.equal(
    directWrites.length,
    governedDirectWrites.length,
    `${label} may write directly only inside its two governed writer functions`,
  );
}

const LOCAL_SUBPROCESS_BOUNDARIES = Object.freeze({
  'scripts/ci/run-unit-test-shard.js': Object.freeze({
    byteLength: 21621,
    runnerSpawn: true,
    sha256: '3b70ad73fa36138ce841e57fa562bd19e4228ceb8f30d7bf6fb794bba6bb0f21',
  }),
  'scripts/stage-2y-structure-m7-v2-repair-work1-recover.mjs': Object.freeze({
    finaliser: 'scripts/stage-2y-structure-m7-v2-repair-work1-finalise.mjs',
    validator: 'scripts/stage-2y-structure-m7-v2-repair-work1-validate.mjs',
  }),
  'scripts/stage-2y-structure-m7-v2-repair-work2-recover.mjs': Object.freeze({
    finaliser: 'scripts/stage-2y-structure-m7-v2-repair-work2-finalise.mjs',
    validator: 'scripts/stage-2y-structure-m7-v2-repair-work2-validate.mjs',
  }),
  'scripts/stage-2y-structure-m7-v2-termination-family-package-seal-receipt.mjs': Object.freeze({
    directNodeArgv: Object.freeze([
      '--test',
      '--test-name-pattern',
      'family package seal',
      'tests/stage-2y-structure-m7-v2-repair-work3.test.js',
    ]),
  }),
});

function assertRunnerSourcePin(source, contract, label) {
  const bytes = Buffer.from(source, 'utf8');
  assert.equal(bytes.length, contract.byteLength, `${label} source byte length must remain pinned`);
  assert.equal(
    crypto.createHash('sha256').update(bytes).digest('hex'),
    contract.sha256,
    `${label} source SHA-256 must remain pinned`,
  );
}

function assertShellDisabled(call, label) {
  const options = call.arguments[2];
  assert.equal(options?.type, 'ObjectExpression', `${label} subprocess options must be literal`);
  const shellProperties = options.properties.filter(
    (property) => property.type === 'Property'
      && !property.computed
      && (property.key.name || property.key.value) === 'shell',
  );
  assert.ok(shellProperties.length <= 1, `${label} shell option must be unique`);
  if (shellProperties.length === 1) {
    assert.equal(shellProperties[0].value.type, 'Literal', `${label} shell option must be literal`);
    assert.equal(shellProperties[0].value.value, false, `${label} must not use a shell`);
  }
}

function assertExactNamedRequire(program, moduleName, importedName, localName, label) {
  const requireCalls = collectCapabilityNodes(
    program,
    (node) => node.type === 'CallExpression'
      && node.callee.type === 'Identifier' && node.callee.name === 'require'
      && node.arguments.length === 1 && node.arguments[0].type === 'Literal'
      && node.arguments[0].value === moduleName,
  );
  assert.equal(requireCalls.length, 1, `${label} must require ${moduleName} exactly once`);
  const declarators = collectCapabilityNodes(
    program,
    (node) => node.type === 'VariableDeclarator' && node.init === requireCalls[0],
  );
  assert.equal(declarators.length, 1, `${label} ${moduleName} require must be bound exactly once`);
  const declarations = collectCapabilityNodes(
    program,
    (node) => node.type === 'VariableDeclaration' && node.declarations.includes(declarators[0]),
  );
  assert.equal(declarations.length, 1, `${label} ${moduleName} binding must have one declaration`);
  assert.equal(declarations[0].kind, 'const', `${label} ${moduleName} binding must be const`);
  assert.equal(declarations[0].declarations.length, 1, `${label} ${moduleName} binding must be isolated`);
  const binding = declarators[0].id;
  assert.equal(binding.type, 'ObjectPattern', `${label} ${moduleName} binding must be named`);
  assert.equal(binding.properties.length, 1, `${label} ${moduleName} binding must be exact`);
  const [property] = binding.properties;
  assert.equal(property.type, 'Property', `${label} ${moduleName} binding must be a property`);
  assert.equal(property.computed, false, `${label} ${moduleName} binding must not be computed`);
  assert.equal(property.key.name, importedName, `${label} imported name drift`);
  assert.equal(property.value.name, localName, `${label} imported name must not be aliased`);
}

function runnerArgvDescriptor(node, label) {
  assert.equal(node?.type, 'ArrayExpression', `${label} lane argv must be a literal array`);
  return node.elements.map((element, index) => {
    assert.ok(element, `${label} lane argv must not contain holes`);
    if (element.type === 'SpreadElement') {
      return `...${staticArgumentDescriptor(element.argument, `${label}[${index}]`)}`;
    }
    if (element.type === 'TemplateLiteral') {
      const parts = [element.quasis[0].value.cooked];
      for (let expressionIndex = 0; expressionIndex < element.expressions.length; expressionIndex += 1) {
        parts.push(
          '${' + staticArgumentDescriptor(
            element.expressions[expressionIndex],
            `${label}[${index}] interpolation`,
          ) + '}',
          element.quasis[expressionIndex + 1].value.cooked,
        );
      }
      return `\`${parts.join('')}\``;
    }
    return staticArgumentDescriptor(element, `${label}[${index}]`);
  });
}

function assertRunnerRunShardBoundary(program, laneArgumentBuild, argsBinding, label) {
  const runShardFunctions = collectCapabilityNodes(
    program,
    (node) => node.type === 'FunctionDeclaration' && node.id?.name === 'runShard',
  );
  assert.equal(runShardFunctions.length, 1, `${label} must declare runShard exactly once`);
  const [runShard] = runShardFunctions;
  assert.equal(runShard.async, true, `${label} runShard must remain async`);
  assert.equal(runShard.generator, false, `${label} runShard must not be a generator`);
  assert.equal(runShard.params.length, 2, `${label} runShard signature must be exact`);
  assert.equal(runShard.params[0]?.type, 'Identifier', `${label} runShard shard parameter must be named`);
  assert.equal(runShard.params[0].name, 'shard', `${label} runShard shard parameter must be exact`);

  const optionsDefault = runShard.params[1];
  assert.equal(optionsDefault?.type, 'AssignmentPattern', `${label} runShard signature must be exact`);
  assert.equal(optionsDefault.right?.type, 'ObjectExpression', `${label} runShard options default must be literal`);
  assert.equal(optionsDefault.right.properties.length, 0, `${label} runShard options default must be empty`);
  assert.equal(optionsDefault.left?.type, 'ObjectPattern', `${label} runShard options must be destructured`);
  assert.deepEqual(
    optionsDefault.left.properties.map((property) => {
      assert.equal(property.type, 'Property', `${label} runShard options must not spread`);
      assert.equal(property.computed, false, `${label} runShard option names must be literal`);
      assert.equal(property.kind, 'init', `${label} runShard options must be data properties`);
      const name = property.key.name || property.key.value;
      assert.ok(['cwd', 'output'].includes(name), `${label} runShard option ${name} is not allowed`);
      assert.equal(property.value.type, 'AssignmentPattern', `${label} runShard option ${name} must have a default`);
      assert.equal(property.value.left.type, 'Identifier', `${label} runShard option ${name} must bind a name`);
      assert.equal(property.value.left.name, name, `${label} runShard option ${name} binding must be exact`);
      if (name === 'cwd') {
        const defaultCall = property.value.right;
        assert.equal(defaultCall.type, 'CallExpression', `${label} runShard cwd default must be a call`);
        assert.equal(defaultCall.arguments.length, 0, `${label} runShard cwd default call must have no arguments`);
        assert.equal(
          staticArgumentDescriptor(defaultCall.callee, `${label} runShard cwd default`),
          '$process.cwd',
          `${label} runShard cwd default must be process.cwd()`,
        );
      } else {
        assert.equal(
          staticArgumentDescriptor(property.value.right, `${label} runShard output default`),
          '$process.stdout',
          `${label} runShard output default must be process.stdout`,
        );
      }
      return name;
    }),
    ['cwd', 'output'],
    `${label} runShard signature must be exact`,
  );
  assert.equal(
    collectCapabilityNodes(runShard.body, (node) => node === laneArgumentBuild).length,
    1,
    `${label} runShard must call the global lane argument builder`,
  );
  assert.equal(
    collectCapabilityNodes(runShard.body, (node) => node === argsBinding).length,
    1,
    `${label} runShard must own the args binding`,
  );
}

function assertRunnerLaneBoundary(program, label) {
  const startLaneFunctions = collectCapabilityNodes(
    program,
    (node) => node.type === 'FunctionDeclaration' && node.id?.name === 'startLane',
  );
  assert.equal(startLaneFunctions.length, 1, `${label} must declare startLane exactly once`);
  assert.deepEqual(
    startLaneFunctions[0].params.map((parameter) => (
      parameter.type === 'Identifier' ? parameter.name : null
    )),
    ['label', 'args', 'outputPath', 'cwd'],
    `${label} startLane signature must be exact`,
  );
  assertIdentifierReferenceCount(program, 'arguments', 0, label);

  const buildLaneArgumentsFunctions = collectCapabilityNodes(
    program,
    (node) => node.type === 'FunctionDeclaration' && node.id?.name === 'buildLaneArguments',
  );
  assert.equal(
    buildLaneArgumentsFunctions.length,
    1,
    `${label} must declare buildLaneArguments exactly once`,
  );
  assert.deepEqual(
    buildLaneArgumentsFunctions[0].params.map((parameter) => (
      parameter.type === 'Identifier' ? parameter.name : null
    )),
    ['plan'],
    `${label} buildLaneArguments signature must be exact`,
  );
  assertIdentifierReferenceCount(program, 'buildLaneArguments', 4, label);
  assert.equal(
    buildLaneArgumentsFunctions[0].body.body.length,
    1,
    `${label} lane argument builder body must contain only its return`,
  );
  const laneArgumentReturn = buildLaneArgumentsFunctions[0].body.body[0];
  assert.equal(laneArgumentReturn.type, 'ReturnStatement', `${label} lane argument builder must return exactly once`);
  const laneArgumentShape = laneArgumentReturn.argument;
  assert.equal(laneArgumentShape?.type, 'ObjectExpression', `${label} lane arguments must be an object literal`);
  const laneArgumentProperties = new Map();
  assert.deepEqual(
    laneArgumentShape.properties.map((property) => {
      assert.equal(property.type, 'Property', `${label} lane argument shape must not spread`);
      assert.equal(property.computed, false, `${label} lane argument names must be literal`);
      assert.equal(property.kind, 'init', `${label} lane argument properties must be data properties`);
      assert.equal(property.value.type, 'ArrayExpression', `${label} lane argv must be literal arrays`);
      const name = property.key.name || property.key.value;
      assert.equal(laneArgumentProperties.has(name), false, `${label} lane argument ${name} must be unique`);
      laneArgumentProperties.set(name, property.value);
      return name;
    }),
    ['ordinary', 'work3', 'heavy'],
    `${label} lane argument output shape must be exact`,
  );
  assert.deepEqual(
    runnerArgvDescriptor(laneArgumentProperties.get('heavy'), `${label} heavy`),
    [
      '--max-old-space-size=8192',
      '--test',
      '--test-reporter=tap',
      '`--test-name-pattern=${$plan.heavyPattern}`',
      '$plan.heavyFile',
    ],
    `${label} heavy lane argv must be exact`,
  );
  assert.deepEqual(
    runnerArgvDescriptor(laneArgumentProperties.get('ordinary'), `${label} ordinary`),
    [
      '--max-old-space-size=8192',
      '--test',
      '--test-reporter=tap',
      '...$plan.ordinaryFiles',
    ],
    `${label} ordinary lane argv must be exact`,
  );
  assert.deepEqual(
    runnerArgvDescriptor(laneArgumentProperties.get('work3'), `${label} Work3`),
    [
      '--max-old-space-size=8192',
      '--test',
      '--test-reporter=tap',
      '`--test-name-pattern=${$plan.work3Pattern}`',
      '$SEALED_WORK3_TEST',
    ],
    `${label} Work3 lane argv must be exact`,
  );
  assertLiteralBinding(
    program,
    'SEALED_WORK3_TEST',
    'tests/stage-2y-structure-m7-v2-repair-work3.test.js',
    label,
  );

  const laneArgumentBuilds = collectCapabilityNodes(
    program,
    (node) => node.type === 'CallExpression'
      && node.callee.type === 'Identifier' && node.callee.name === 'buildLaneArguments',
  );
  assert.equal(laneArgumentBuilds.length, 1, `${label} must build lane arguments exactly once`);
  assert.deepEqual(
    laneArgumentBuilds[0].arguments.map((argument) => (
      staticArgumentDescriptor(argument, `${label} buildLaneArguments`)
    )),
    ['$plan'],
    `${label} lane argument build call must be exact`,
  );
  const argsBindings = collectCapabilityNodes(
    program,
    (node) => node.type === 'VariableDeclarator'
      && node.id.type === 'Identifier' && node.id.name === 'args'
      && node.init === laneArgumentBuilds[0],
  );
  assert.equal(argsBindings.length, 1, `${label} lane arguments must bind to args exactly once`);
  const argsDeclarations = collectCapabilityNodes(
    program,
    (node) => node.type === 'VariableDeclaration' && node.declarations.includes(argsBindings[0]),
  );
  assert.equal(argsDeclarations.length, 1, `${label} args binding must have one declaration`);
  assert.equal(argsDeclarations[0].kind, 'const', `${label} args binding must be const`);
  assert.equal(argsDeclarations[0].declarations.length, 1, `${label} args binding must be isolated`);
  assertRunnerRunShardBoundary(program, laneArgumentBuilds[0], argsBindings[0], label);

  const laneCalls = collectCapabilityNodes(
    program,
    (node) => node.type === 'CallExpression'
      && node.callee.type === 'Identifier' && node.callee.name === 'startLane',
  );
  assert.equal(laneCalls.length, 3, `${label} must call startLane exactly three times`);
  assert.deepEqual(
    laneCalls.map((call) => call.arguments.map((argument, index) => (
      staticArgumentDescriptor(argument, `${label} startLane argument ${index + 1}`)
    ))),
    [
      ['ordinary', '$args.ordinary', '$ordinaryOutput', '$cwd'],
      ['Work3', '$args.work3', '$work3Output', '$cwd'],
      ['heavy', '$args.heavy', '$heavyOutput', '$cwd'],
    ],
    `${label} lane calls must be exact`,
  );
  assertIdentifierReferenceCount(program, 'startLane', 4, label);
  assertIdentifierReferenceCount(program, 'args', 6, label);
  assertIdentifierNeverReassigned(program, 'args', label);
}

function assertRunnerSpawnBoundary(program, counts, label) {
  assertExactNamedRequire(program, 'node:child_process', 'spawn', 'spawn', label);
  assertIdentifierReferenceCount(program, 'spawn', 3, label);
  assertRunnerLaneBoundary(program, label);
  const launches = collectCapabilityNodes(
    program,
    (node) => node.type === 'CallExpression'
      && node.callee.type === 'Identifier' && node.callee.name === 'spawn',
  );
  assert.equal(launches.length, 1, `${label} must launch exactly one child`);
  assert.equal(counts.external_process, launches.length + 1, `${label} subprocess authority must be explicit`);
  const [launch] = launches;
  assert.equal(launch.arguments.length, 3, `${label} spawn call must have three arguments`);
  assert.equal(
    staticArgumentDescriptor(launch.arguments[0], `${label} executable`),
    '$process.execPath',
    `${label} must launch only process.execPath`,
  );
  assert.equal(launch.arguments[1].type, 'Identifier', `${label} argv must be a named binding`);
  assert.equal(launch.arguments[1].name, 'args', `${label} argv binding must be args`);
  assertShellDisabled(launch, label);

  const options = launch.arguments[2];
  const optionProperties = new Map();
  for (const property of options.properties) {
    assert.equal(property.type, 'Property', `${label} subprocess options must not spread`);
    assert.equal(property.computed, false, `${label} subprocess option names must be literal`);
    const name = property.key.name || property.key.value;
    assert.ok(['cwd', 'env', 'stdio', 'shell'].includes(name), `${label} subprocess option ${name} is not allowed`);
    assert.equal(optionProperties.has(name), false, `${label} subprocess option ${name} must be unique`);
    optionProperties.set(name, property.value);
  }
  assert.deepEqual(
    [...optionProperties.keys()].filter((name) => name !== 'shell').sort(),
    ['cwd', 'env', 'stdio'],
    `${label} subprocess options must contain exact cwd, env, and stdio properties`,
  );
  assert.equal(staticArgumentDescriptor(optionProperties.get('cwd'), `${label} cwd`), '$cwd');
  assert.equal(staticArgumentDescriptor(optionProperties.get('env'), `${label} env`), '$process.env');
  assert.deepEqual(
    staticArgvDescriptor(optionProperties.get('stdio'), `${label} stdio`),
    ['ignore', '$descriptor', '$descriptor'],
  );
}

function assertLocalSubprocessArtifactWriterBoundary(source, label) {
  const contract = LOCAL_SUBPROCESS_BOUNDARIES[label];
  assert.ok(contract, `${label} must have an exact subprocess contract`);
  assertNoCapabilities(source, LOCAL_SUBPROCESS_WRITER_FORBIDDEN_CAPABILITIES, label);
  const counts = capabilityCounts(source, label);
  assert.ok(counts.filesystem_write > 0, `${label} must write local artefacts`);
  const program = parseCapabilitySource(source, label);
  if (contract.runnerSpawn) {
    assertRunnerSpawnBoundary(program, counts, label);
    assertRunnerSourcePin(source, contract, label);
    return;
  }
  assertExactNamedImport(program, 'node:child_process', 'spawnSync', 'spawnSync', label);
  const launches = collectCapabilityNodes(
    program,
    (node) => node.type === 'CallExpression'
      && node.callee.type === 'Identifier' && node.callee.name === 'spawnSync',
  );
  assert.equal(counts.external_process, launches.length + 1, `${label} subprocess authority must be explicit`);
  launches.forEach((launch) => assertShellDisabled(launch, label));

  const gitLaunches = launches.filter(
    (launch) => launch.arguments[0]?.type === 'Literal'
      && launch.arguments[0].value === '/usr/bin/git',
  );
  const nodeLaunches = launches.filter(
    (launch) => staticArgumentDescriptor(launch.arguments[0], `${label} executable`) === '$process.execPath',
  );
  assert.equal(launches.length, gitLaunches.length + nodeLaunches.length, `${label} executable set must be exact`);

  if (contract.directNodeArgv) {
    assert.equal(gitLaunches.length, 0, `${label} must not launch Git`);
    assert.equal(nodeLaunches.length, 1, `${label} must launch one exact Node child`);
    assert.deepEqual(
      staticArgvDescriptor(nodeLaunches[0].arguments[1], `${label} Node`),
      [...contract.directNodeArgv],
    );
    return;
  }

  assert.equal(gitLaunches.length, 1, `${label} must inspect Git status exactly once`);
  assert.deepEqual(
    staticArgvDescriptor(gitLaunches[0].arguments[1], `${label} Git`),
    ['status', '--porcelain=v1', '--untracked-files=all'],
  );
  assert.equal(nodeLaunches.length, 1, `${label} must declare one governed Node launch`);
  assert.deepEqual(
    staticArgvDescriptor(nodeLaunches[0].arguments[1], `${label} Node`),
    ['$repositoryPath'],
  );
  assertLiteralBinding(program, 'FINALISER_PATH', contract.finaliser, label);
  assertLiteralBinding(program, 'VALIDATOR_PATH', contract.validator, label);
  const wrappers = collectCapabilityNodes(
    program,
    (node) => node.type === 'FunctionDeclaration' && node.id?.name === 'runGovernedChild',
  );
  assert.equal(wrappers.length, 1, `${label} governed child wrapper must be unique`);
  assert.deepEqual(
    wrappers[0].params.map((param) => param.type === 'Identifier' ? param.name : null),
    ['root', 'repositoryPath', 'failureCode'],
    `${label} governed child wrapper parameters must be exact`,
  );
  assertIdentifierNeverReassigned(program, 'repositoryPath', label);
  const wrapperCalls = collectCapabilityNodes(
    program,
    (node) => node.type === 'CallExpression'
      && node.callee.type === 'Identifier' && node.callee.name === 'runGovernedChild',
  );
  assert.deepEqual(
    wrapperCalls.map((call) => staticArgumentDescriptor(call.arguments[1], `${label} governed child path`)),
    ['$FINALISER_PATH', '$VALIDATOR_PATH'],
    `${label} governed Node children must remain exact`,
  );
}

const REMOTE_REVIEW_INSPECTOR_GIT_TEXT_CALLS = Object.freeze([
  Object.freeze(['cat-file', '-e', '`${$ARCHIVED_REVIEW_TARGET_COMMIT_SHA}^{commit}`']),
  Object.freeze(['show', '-s', '--format=%P', '$ARCHIVED_REVIEW_TARGET_COMMIT_SHA']),
  Object.freeze(['show', '-s', '--format=%T', '$ARCHIVED_REVIEW_TARGET_COMMIT_SHA']),
  Object.freeze(['diff-tree', '--no-commit-id', '--name-only', '-r', '$ARCHIVED_REVIEW_TARGET_COMMIT_SHA']),
  Object.freeze(['ls-tree', '-r', '--full-tree', '$ARCHIVED_REVIEW_TARGET_COMMIT_SHA', '--', '$binding.path']),
  Object.freeze(['ls-tree', '-r', '--full-tree', '$commitSha', '--', '$repositoryPath']),
  Object.freeze(['branch', '--show-current']),
  Object.freeze(['rev-parse', 'HEAD']),
  Object.freeze(['remote', 'get-url', 'origin']),
  Object.freeze(['rev-parse', '$REVIEW_TARGET_REMOTE_REF']),
  Object.freeze(['ls-remote', '--exit-code', '$REVIEW_TARGET_ORIGIN_URL', '$REVIEW_TARGET_REMOTE_BRANCH_REF']),
  Object.freeze(['rev-list', '--parents', '-n', '1', '$commitSha']),
  Object.freeze(['diff-tree', '--no-commit-id', '--name-only', '-r', '$commitSha']),
  Object.freeze(['show', '-s', '--format=%T', '$commitSha']),
]);
const REMOTE_REVIEW_INSPECTOR_GIT_BYTES_CALLS = Object.freeze([
  Object.freeze(['cat-file', 'blob', '$binding.git_blob_oid']),
]);

const REMOTE_REVIEW_GATED_WRITER_GIT_CALLS = Object.freeze([
  Object.freeze(['ls-tree', '-r', '--full-tree', '$REVIEW_TARGET_COMMIT_SHA', '--', '$binding.path']),
  Object.freeze(['cat-file', '-s', '$binding.git_blob_oid']),
  Object.freeze(['remote', 'get-url', 'origin']),
  Object.freeze(['symbolic-ref', '--quiet', 'HEAD']),
  Object.freeze(['ls-remote', '--exit-code', '$REVIEW_TARGET_ORIGIN_URL', '$REVIEW_TARGET_LIVE_BRANCH_REF']),
  Object.freeze(['cat-file', '-e', '`${$liveRemoteTip}^{commit}`']),
  Object.freeze(['merge-base', '--is-ancestor', '$REVIEW_TARGET_COMMIT_SHA', '$liveRemoteTip']),
  Object.freeze(['cat-file', '-e', '`${$REVIEW_TARGET_COMMIT_SHA}^{commit}`']),
  Object.freeze(['show', '-s', '--format=%P', '$REVIEW_TARGET_COMMIT_SHA']),
  Object.freeze(['show', '-s', '--format=%T', '$REVIEW_TARGET_COMMIT_SHA']),
  Object.freeze(['diff-tree', '--no-commit-id', '--name-only', '-r', '$REVIEW_TARGET_COMMIT_SHA']),
  Object.freeze(['ls-tree', '-r', '--full-tree', '$REVIEW_TARGET_COMMIT_SHA', '--', '$pathBinding.path']),
]);
const REMOTE_REVIEW_GATED_WRITER_GIT_BYTES_CALLS = Object.freeze([
  Object.freeze(['cat-file', 'blob', '$binding.git_blob_oid']),
]);

function staticObjectDescriptor(node, label) {
  assert.equal(node?.type, 'ObjectExpression', `${label} must be an object literal`);
  return node.properties.map((property, index) => {
    if (property.type === 'SpreadElement') {
      return ['...', staticArgumentDescriptor(property.argument, `${label}[${index}]`)];
    }
    assert.equal(property.type, 'Property', `${label}[${index}] must be one property`);
    assert.equal(property.kind, 'init', `${label}[${index}] must initialise one property`);
    assert.equal(property.computed, false, `${label}[${index}] key must be static`);
    const key = property.key.type === 'Identifier' ? property.key.name : property.key.value;
    const value = property.value.type === 'ArrayExpression'
      ? staticArgvDescriptor(property.value, `${label}.${key}`)
      : staticArgumentDescriptor(property.value, `${label}.${key}`);
    return [key, value];
  });
}

function exactGitWrappers(program, contracts, label) {
  const processCalls = collectCapabilityNodes(
    program,
    (node) => node.type === 'CallExpression'
      && node.callee.type === 'Identifier' && node.callee.name === 'execFileSync',
  );
  assert.equal(processCalls.length, contracts.length, `${label} Git wrappers must be the only process launches`);
  for (const contract of contracts) {
    const { name } = contract;
    const wrappers = collectCapabilityNodes(
      program,
      (node) => node.type === 'FunctionDeclaration' && node.id?.name === name,
    );
    assert.equal(wrappers.length, 1, `${label} ${name} wrapper must be unique`);
    assert.deepEqual(
      wrappers[0].params.map((param) => {
        if (param.type === 'Identifier') return param.name;
        if (param.type === 'AssignmentPattern' && param.left.type === 'Identifier'
            && param.right.type === 'ObjectExpression'
            && param.right.properties.length === 0) return `${param.left.name}={}`;
        return null;
      }),
      contract.params,
      `${label} ${name} wrapper parameters must be exact`,
    );
    const statements = wrappers[0].body.body;
    assert.equal(statements.length, 4, `${label} ${name} wrapper body must be exact`);
    assert.equal(statements[0].type, 'VariableDeclaration', `${label} ${name} environment declaration must be exact`);
    assert.equal(statements[0].kind, 'const', `${label} ${name} environment must be immutable`);
    assert.equal(statements[0].declarations.length, 1, `${label} ${name} environment declaration must be unique`);
    assert.equal(statements[0].declarations[0].id?.name, 'environment', `${label} ${name} environment name must be exact`);
    assert.deepEqual(
      staticObjectDescriptor(statements[0].declarations[0].init, `${label} ${name} environment`),
      [
        ['...', '$process.env'],
        ['GIT_NO_REPLACE_OBJECTS', '1'],
      ],
      `${label} ${name} Git environment must be exact`,
    );
    for (const [index, property] of ['GIT_DIR', 'GIT_WORK_TREE'].entries()) {
      const statement = statements[index + 1];
      assert.equal(statement.type, 'ExpressionStatement', `${label} ${name} ${property} deletion must be exact`);
      assert.equal(statement.expression?.type, 'UnaryExpression', `${label} ${name} ${property} deletion must be unary`);
      assert.equal(statement.expression.operator, 'delete', `${label} ${name} must delete ${property}`);
      assert.equal(
        staticArgumentDescriptor(statement.expression.argument, `${label} ${name} ${property}`),
        `$environment.${property}`,
        `${label} ${name} must delete only ${property}`,
      );
    }
    const launches = collectCapabilityNodes(
      wrappers[0],
      (node) => node.type === 'CallExpression'
        && node.callee.type === 'Identifier' && node.callee.name === 'execFileSync',
    );
    assert.equal(launches.length, 1, `${label} ${name} wrapper must launch Git exactly once`);
    assert.equal(launches[0].arguments.length, 3, `${label} ${name} Git launch arguments must be exact`);
    assert.deepEqual(
      launches[0].arguments.slice(0, 2).map(
        (argument) => staticArgumentDescriptor(argument, `${label} ${name} wrapper`),
      ),
      ['git', '$argv'],
      `${label} ${name} wrapper executable and argv must be exact`,
    );
    assert.deepEqual(
      staticObjectDescriptor(launches[0].arguments[2], `${label} ${name} Git options`),
      contract.options,
      `${label} ${name} Git options must be exact`,
    );
    const returnStatement = statements[3];
    assert.equal(returnStatement.type, 'ReturnStatement', `${label} ${name} wrapper must return directly`);
    if (contract.trim) {
      assert.equal(returnStatement.argument?.type, 'CallExpression', `${label} ${name} wrapper must return trim()`);
      assert.equal(staticMemberName(returnStatement.argument.callee), 'trim', `${label} ${name} wrapper must return trim()`);
      assert.equal(returnStatement.argument.callee.object, launches[0], `${label} ${name} wrapper must trim Git stdout directly`);
    } else {
      assert.equal(returnStatement.argument, launches[0], `${label} ${name} wrapper must return Git bytes directly`);
    }
  }
  assertIdentifierNeverReassigned(program, 'argv', label);
}

function exactWrapperCallRoster(program, name, argvIndex, expected, label, leading = []) {
  const calls = collectCapabilityNodes(
    program,
    (node) => node.type === 'CallExpression'
      && node.callee.type === 'Identifier' && node.callee.name === name,
  );
  assert.deepEqual(
    calls.map((call, index) => {
      assert.equal(call.arguments.length, argvIndex + 1, `${label} ${name} call ${index + 1} argument count must be exact`);
      assert.deepEqual(
        call.arguments.slice(0, argvIndex).map(
          (argument) => staticArgumentDescriptor(argument, `${label} ${name} call ${index + 1}`),
        ),
        leading,
        `${label} ${name} call ${index + 1} leading arguments must be exact`,
      );
      return staticArgvDescriptor(call.arguments[argvIndex], `${label} ${name} call ${index + 1}`);
    }),
    expected.map((argv) => [...argv]),
    `${label} ${name} call set and argv must be exact`,
  );
}

function uniqueFunctionDeclaration(program, name, label) {
  const declarations = collectCapabilityNodes(
    program,
    (node) => node.type === 'FunctionDeclaration' && node.id?.name === name,
  );
  assert.equal(declarations.length, 1, `${label} ${name} function must be unique`);
  return declarations[0];
}

function exactNamedCall(functionNode, name, expectedArguments, label) {
  const calls = collectCapabilityNodes(
    functionNode,
    (node) => node.type === 'CallExpression'
      && node.callee.type === 'Identifier' && node.callee.name === name,
  );
  assert.equal(calls.length, 1, `${label} must call ${name} exactly once`);
  assert.deepEqual(
    calls[0].arguments.map(
      (argument) => staticArgumentDescriptor(argument, `${label} ${name}`),
    ),
    expectedArguments,
    `${label} ${name} arguments must be exact`,
  );
  return calls[0];
}

function exactDirectNamedCall(functionNode, name, expectedArguments, label) {
  const call = exactNamedCall(functionNode, name, expectedArguments, label);
  const directStatements = functionNode.body.body.filter(
    (statement) => statement.type === 'ExpressionStatement'
      && statement.expression.type === 'CallExpression'
      && statement.expression.callee.type === 'Identifier'
      && statement.expression.callee.name === name,
  );
  assert.equal(
    directStatements.length,
    1,
    `${label} must call ${name} as one direct top-level expression`,
  );
  assert.equal(
    directStatements[0].expression,
    call,
    `${label} direct ${name} call must be the unique call`,
  );
  return {
    call,
    statementIndex: functionNode.body.body.indexOf(directStatements[0]),
  };
}

function staticExpressionDescriptor(node, label) {
  if (node?.type === 'BinaryExpression') {
    return [
      node.operator,
      staticExpressionDescriptor(node.left, `${label} left`),
      staticExpressionDescriptor(node.right, `${label} right`),
    ];
  }
  if (node?.type === 'CallExpression') {
    return [
      'call',
      staticArgumentDescriptor(node.callee, `${label} callee`),
      node.arguments.map(
        (argument, index) => staticExpressionDescriptor(argument, `${label}[${index}]`),
      ),
    ];
  }
  return staticArgumentDescriptor(node, label);
}

function exactCallArgumentRoster(program, name, expected, label) {
  const calls = collectCapabilityNodes(
    program,
    (node) => node.type === 'CallExpression'
      && node.callee.type === 'Identifier' && node.callee.name === name,
  );
  assert.deepEqual(
    calls.map((call, callIndex) => call.arguments.map(
      (argument, argumentIndex) => staticExpressionDescriptor(
        argument,
        `${label} ${name} call ${callIndex + 1} argument ${argumentIndex + 1}`,
      ),
    )),
    expected,
    `${label} ${name} call roster must be exact`,
  );
}

function functionBindingInitializer(functionNode, name, label) {
  const declarations = collectCapabilityNodes(
    functionNode,
    (node) => node.type === 'VariableDeclarator'
      && node.id.type === 'Identifier' && node.id.name === name,
  );
  assert.equal(declarations.length, 1, `${label} ${name} binding must be unique`);
  return declarations[0].init;
}

function staticNestedArrayDescriptor(node, label) {
  assert.equal(node?.type, 'ArrayExpression', `${label} must be a literal array`);
  return node.elements.map((element, index) => (
    element?.type === 'ArrayExpression'
      ? staticNestedArrayDescriptor(element, `${label}[${index}]`)
      : staticArgumentDescriptor(element, `${label}[${index}]`)
  ));
}

function assertWriterOutputPathDerivation(program, label) {
  const outputPaths = ['$APPLICATION_RECEIPT_PATH', '$SUCCESSOR_MANIFEST_PATH'];
  const preflight = uniqueFunctionDeclaration(program, 'preflightOutputs', label);
  assert.deepEqual(
    preflight.params.map((param) => param.type === 'Identifier' ? param.name : null),
    ['root'],
    `${label} preflightOutputs parameters must be exact`,
  );
  const targets = functionBindingInitializer(preflight, 'targets', `${label} preflightOutputs`);
  assert.equal(targets?.type, 'CallExpression', `${label} preflightOutputs targets must use map`);
  assert.equal(staticMemberName(targets.callee), 'map', `${label} preflightOutputs targets must use map`);
  assert.deepEqual(
    staticArgvDescriptor(targets.callee.object, `${label} preflightOutputs target paths`),
    outputPaths,
    `${label} preflightOutputs must derive only the two output paths`,
  );
  assert.equal(targets.arguments.length, 1, `${label} preflightOutputs map callback must be unique`);
  assert.equal(
    targets.arguments[0]?.type,
    'ArrowFunctionExpression',
    `${label} preflightOutputs map callback must remain inline`,
  );

  const writer = uniqueFunctionDeclaration(program, 'writeOutputs', label);
  assert.deepEqual(
    writer.params.map((param) => param.type === 'Identifier' ? param.name : null),
    ['targets', 'applicationBytes', 'successorBytes'],
    `${label} writeOutputs parameters must be exact`,
  );
  const bytesByPath = functionBindingInitializer(
    writer,
    'bytesByPath',
    `${label} writeOutputs`,
  );
  assert.equal(bytesByPath?.type, 'NewExpression', `${label} writeOutputs bytes map must be exact`);
  assert.equal(bytesByPath.callee?.type, 'Identifier', `${label} writeOutputs bytes map must use Map`);
  assert.equal(bytesByPath.callee.name, 'Map', `${label} writeOutputs bytes map must use Map`);
  assert.equal(bytesByPath.arguments.length, 1, `${label} writeOutputs bytes map input must be unique`);
  assert.deepEqual(
    staticNestedArrayDescriptor(
      bytesByPath.arguments[0],
      `${label} writeOutputs bytes map`,
    ),
    [
      ['$APPLICATION_RECEIPT_PATH', '$applicationBytes'],
      ['$SUCCESSOR_MANIFEST_PATH', '$successorBytes'],
    ],
    `${label} writeOutputs must derive bytes only for the two output paths`,
  );
}

function assertReviewValidationCallGraph(program, label) {
  const failFunction = uniqueFunctionDeclaration(program, 'fail', label);
  assert.deepEqual(
    failFunction.params.map((param) => param.type === 'Identifier' ? param.name : null),
    ['code', 'detail'],
    `${label} fail parameters must be exact`,
  );
  assert.equal(failFunction.body.body.length, 1, `${label} fail body must be exact`);
  const failStatement = failFunction.body.body[0];
  assert.equal(failStatement.type, 'ThrowStatement', `${label} fail must throw`);
  assert.equal(
    failStatement.argument?.type,
    'NewExpression',
    `${label} fail must construct Work3ClosureApplicationError`,
  );
  assert.equal(
    failStatement.argument.callee?.type,
    'Identifier',
    `${label} fail must construct Work3ClosureApplicationError`,
  );
  assert.equal(
    failStatement.argument.callee.name,
    'Work3ClosureApplicationError',
    `${label} fail must construct Work3ClosureApplicationError`,
  );
  assert.deepEqual(
    failStatement.argument.arguments.map(
      (argument) => staticArgumentDescriptor(argument, `${label} fail`),
    ),
    ['$code', '$detail'],
    `${label} fail arguments must be exact`,
  );

  const validator = uniqueFunctionDeclaration(
    program,
    'validatePinnedExternalReviewReceipt',
    label,
  );
  assert.deepEqual(
    validator.params.map((param) => param.type === 'Identifier' ? param.name : null),
    ['amendment', 'review', 'reviewBytes', 'observedReviewTargetCommitBinding'],
    `${label} validatePinnedExternalReviewReceipt parameters must be exact`,
  );
  assert.deepEqual(
    validator.body.body.map((statement) => statement.type),
    [
      'VariableDeclaration',
      'IfStatement',
      'VariableDeclaration',
      'VariableDeclaration',
      'ExpressionStatement',
      'IfStatement',
      'VariableDeclaration',
      'IfStatement',
      'VariableDeclaration',
      'VariableDeclaration',
      'IfStatement',
      'VariableDeclaration',
      'VariableDeclaration',
      'VariableDeclaration',
      'IfStatement',
    ],
    `${label} validatePinnedExternalReviewReceipt body must remain exact`,
  );
  const requiredValidatorCalls = Object.freeze({
    canonicalBytes: 1,
    contentId: 1,
    exactKeys: 6,
    fail: 5,
    normalisedVendorId: 2,
    same: 10,
  });
  for (const [name, expectedCount] of Object.entries(requiredValidatorCalls)) {
    const calls = collectCapabilityNodes(
      validator,
      (node) => node.type === 'CallExpression'
        && node.callee.type === 'Identifier' && node.callee.name === name,
    );
    assert.equal(
      calls.length,
      expectedCount,
      `${label} validatePinnedExternalReviewReceipt ${name} call count must be exact`,
    );
  }
  const validatorReturns = collectCapabilityNodes(
    validator,
    (node) => node.type === 'ReturnStatement',
  );
  assert.equal(
    validatorReturns.length,
    0,
    `${label} validatePinnedExternalReviewReceipt must not return before validation closes`,
  );

  const historicalReview = uniqueFunctionDeclaration(program, 'validateHistoricalReview', label);
  const reviewCall = exactDirectNamedCall(
    historicalReview,
    'validatePinnedExternalReviewReceipt',
    ['$amendment', '$review', '$reviewBytes', '$observedReviewTargetCommitBinding'],
    `${label} validateHistoricalReview`,
  );
  const historicalReturns = collectCapabilityNodes(
    historicalReview,
    (node) => node.type === 'ReturnStatement',
  );
  assert.equal(historicalReturns.length, 1, `${label} validateHistoricalReview return must be unique`);
  assert.ok(
    reviewCall.statementIndex < historicalReview.body.body.indexOf(historicalReturns[0]),
    `${label} validateHistoricalReview must validate the receipt before returning`,
  );

  const application = uniqueFunctionDeclaration(program, 'applyWork3Closure', label);
  const historicalReviewCall = exactDirectNamedCall(
    application,
    'validateHistoricalReview',
    ['$root', '$amendment', '$reviewInput.record', '$reviewInput.bytes'],
    `${label} applyWork3Closure`,
  );
  const writeCall = exactDirectNamedCall(
    application,
    'writeOutputs',
    ['$targets', '$applicationBytes', '$successorBytes'],
    `${label} applyWork3Closure`,
  );
  assert.ok(
    historicalReviewCall.statementIndex < writeCall.statementIndex,
    `${label} applyWork3Closure must close external review before writeOutputs`,
  );
}

function assertRemoteGitReviewInspectorBoundary(source, label) {
  assertNoCapabilities(source, REMOTE_GIT_REVIEW_INSPECTOR_FORBIDDEN_CAPABILITIES, label);
  const counts = capabilityCounts(source, label);
  assert.equal(counts.network, 1, `${label} must have exactly one pinned remote Git observation`);
  assert.equal(counts.filesystem_write, 0, `${label} must remain read-only`);
  const program = parseCapabilitySource(source, label);
  assertExactNamedImport(program, 'node:child_process', 'execFileSync', 'execFileSync', label);
  assertExactFileSystemImportRoster(program, [
    ['existsSync', 'existsSync'],
    ['readFileSync', 'readFileSync'],
  ], label);
  exactCallArgumentRoster(program, 'existsSync', [
    [
      ['call', '$join', ['$REPO_ROOT', '$packagePath']],
    ],
  ], label);
  exactCallArgumentRoster(program, 'readFileSync', [
    [
      ['call', '$join', ['$REPO_ROOT', '$repositoryPath']],
    ],
  ], label);
  assertIdentifierReferenceCount(program, 'existsSync', 3, label);
  assertIdentifierReferenceCount(program, 'readFileSync', 3, label);
  exactGitWrappers(program, [
    {
      name: 'gitText',
      params: ['argv'],
      options: [
        ['cwd', '$REPO_ROOT'],
        ['encoding', 'utf8'],
        ['env', '$environment'],
        ['stdio', ['ignore', 'pipe', 'pipe']],
      ],
      trim: true,
    },
    {
      name: 'gitBytes',
      params: ['argv'],
      options: [
        ['cwd', '$REPO_ROOT'],
        ['env', '$environment'],
        ['stdio', ['ignore', 'pipe', 'pipe']],
      ],
      trim: false,
    },
  ], label);
  assert.equal(counts.external_process, 3, `${label} process authority must be import plus two Git wrappers`);
  exactWrapperCallRoster(
    program,
    'gitText',
    0,
    REMOTE_REVIEW_INSPECTOR_GIT_TEXT_CALLS,
    label,
  );
  exactWrapperCallRoster(
    program,
    'gitBytes',
    0,
    REMOTE_REVIEW_INSPECTOR_GIT_BYTES_CALLS,
    label,
  );
  assertLiteralBinding(program, 'REVIEW_TARGET_BRANCH', 'codex/recover-m7-20260812', label);
  assertStaticConstBinding(program, 'REVIEW_TARGET_REMOTE_REF', '`origin/${$REVIEW_TARGET_BRANCH}`', label);
  assertStaticConstBinding(program, 'REVIEW_TARGET_REMOTE_BRANCH_REF', '`refs/heads/${$REVIEW_TARGET_BRANCH}`', label);
  assertLiteralBinding(
    program,
    'REVIEW_TARGET_ORIGIN_URL',
    'https://github.com/CodeNameHash/precedent-machine.git',
    label,
  );
  assertLiteralBinding(
    program,
    'ARCHIVED_REVIEW_TARGET_COMMIT_SHA',
    'f87b4e5cdcfc2a9fe68f4803ae273865322ee966',
    label,
  );
}

function assertRemoteGitReviewGatedArtifactWriterBoundary(source, label) {
  assertNoCapabilities(source, REMOTE_GIT_REVIEW_GATED_WRITER_FORBIDDEN_CAPABILITIES, label);
  const counts = capabilityCounts(source, label);
  assert.equal(counts.network, 1, `${label} must have exactly one pinned remote Git observation`);
  assert.equal(counts.filesystem_write, 2, `${label} filesystem write capability count must be exact`);
  const program = parseCapabilitySource(source, label);
  assertReviewValidationCallGraph(program, label);
  assertWriterOutputPathDerivation(program, label);
  assertExactNamedImport(program, 'node:child_process', 'execFileSync', 'execFileSync', label);
  assertExactFileSystemImportRoster(program, [
    ['closeSync', 'closeSync'],
    ['constants', 'fsConstants'],
    ['fsyncSync', 'fsyncSync'],
    ['lstatSync', 'lstatSync'],
    ['openSync', 'openSync'],
    ['readFileSync', 'readFileSync'],
    ['realpathSync', 'realpathSync'],
    ['unlinkSync', 'unlinkSync'],
    ['writeSync', 'writeSync'],
  ], label);
  exactCallArgumentRoster(program, 'openSync', [
    [
      ['call', '$path.dirname', ['$absolute']],
      [
        '|',
        ['|', '$fsConstants.O_RDONLY', '$fsConstants.O_DIRECTORY'],
        '$fsConstants.O_NOFOLLOW',
      ],
    ],
    [
      '$target.absolute',
      [
        '|',
        [
          '|',
          ['|', '$fsConstants.O_CREAT', '$fsConstants.O_EXCL'],
          '$fsConstants.O_WRONLY',
        ],
        '$fsConstants.O_NOFOLLOW',
      ],
      420,
    ],
  ], label);
  exactCallArgumentRoster(program, 'writeSync', [
    [
      '$descriptor',
      '$bytes',
      '$offset',
      ['-', '$bytes.length', '$offset'],
      '$offset',
    ],
  ], label);
  exactCallArgumentRoster(program, 'unlinkSync', [
    ['$absolute'],
  ], label);
  exactCallArgumentRoster(program, 'fsyncSync', [
    ['$descriptor'],
    ['$descriptor'],
  ], label);
  exactCallArgumentRoster(program, 'closeSync', [
    ['$descriptor'],
    ['$descriptor'],
  ], label);
  exactCallArgumentRoster(program, 'writeAll', [
    [
      '$descriptor',
      ['call', '$bytesByPath.get', ['$target.repositoryPath']],
    ],
  ], label);
  exactCallArgumentRoster(program, 'fsyncParent', [
    ['$target.absolute'],
    ['$absolute'],
  ], label);
  assertIdentifierReferenceCount(program, 'openSync', 4, label);
  assertIdentifierReferenceCount(program, 'writeSync', 3, label);
  assertIdentifierReferenceCount(program, 'unlinkSync', 3, label);
  assertIdentifierReferenceCount(program, 'fsyncSync', 4, label);
  assertIdentifierReferenceCount(program, 'closeSync', 4, label);
  exactGitWrappers(program, [
    {
      name: 'git',
      params: ['root', 'argv', 'options={}'],
      options: [
        ['cwd', '$root'],
        ['encoding', 'utf8'],
        ['env', '$environment'],
        ['stdio', ['ignore', 'pipe', 'pipe']],
        ['...', '$options'],
      ],
      trim: true,
    },
    {
      name: 'gitBytes',
      params: ['root', 'argv'],
      options: [
        ['cwd', '$root'],
        ['env', '$environment'],
        ['stdio', ['ignore', 'pipe', 'pipe']],
      ],
      trim: false,
    },
  ], label);
  assert.equal(counts.external_process, 3, `${label} process authority must be import plus two Git wrappers`);
  assertIdentifierNeverReassigned(program, 'root', label);
  assertIdentifierNeverReassigned(program, 'options', label);
  exactWrapperCallRoster(
    program,
    'git',
    1,
    REMOTE_REVIEW_GATED_WRITER_GIT_CALLS,
    label,
    ['$root'],
  );
  exactWrapperCallRoster(
    program,
    'gitBytes',
    1,
    REMOTE_REVIEW_GATED_WRITER_GIT_BYTES_CALLS,
    label,
    ['$root'],
  );
  assertLiteralBinding(program, 'REVIEW_TARGET_BRANCH', 'codex/recover-m7-20260812', label);
  assertLiteralBinding(program, 'REVIEW_TARGET_REMOTE_REF', 'origin/codex/recover-m7-20260812', label);
  assertLiteralBinding(program, 'REVIEW_TARGET_LIVE_BRANCH_REF', 'refs/heads/codex/recover-m7-20260812', label);
  assertLiteralBinding(
    program,
    'REVIEW_TARGET_ORIGIN_URL',
    'https://github.com/CodeNameHash/precedent-machine.git',
    label,
  );
  assertLiteralBinding(
    program,
    'REVIEW_TARGET_COMMIT_SHA',
    'f87b4e5cdcfc2a9fe68f4803ae273865322ee966',
    label,
  );
  assertLiteralBinding(
    program,
    'CONTROL',
    'evidence/canonical-v2/stage-2y-structure-migration/control',
    label,
  );
  assertStaticConstBinding(
    program,
    'APPLICATION_RECEIPT_PATH',
    '`${$CONTROL}/m7-v2-repair-work3-execution-manifest-closure-amendment-application-receipt.json`',
    label,
  );
  assertStaticConstBinding(
    program,
    'SUCCESSOR_MANIFEST_PATH',
    '`${$CONTROL}/m7-v2-repair-work3-execution-manifest-closure-successor.json`',
    label,
  );
}

function assertRemoteSourceAdmissionWriterBoundary(source, label) {
  assertNoCapabilities(source, NETWORK_WRITER_FORBIDDEN_CAPABILITIES, label);
  const counts = capabilityCounts(source, label);
  assert.equal(counts.network, 1, `${label} must have only its governed HTTPS boundary`);
  assert.ok(counts.filesystem_write > 0, `${label} must write admitted source artefacts`);
  const program = parseCapabilitySource(source, label);
  assertExactDefaultImport(program, 'node:https', 'https', label);
  const defaults = collectCapabilityNodes(
    program,
    (node) => node.type === 'AssignmentPattern'
      && node.left.type === 'Identifier' && node.left.name === 'httpsGet',
  );
  assert.equal(defaults.length, 1, `${label} HTTPS injection point must be unique`);
  assert.equal(
    staticArgumentDescriptor(defaults[0].right, `${label} HTTPS injection point`),
    '$https.get',
  );
  assertIdentifierNeverReassigned(program, 'httpsGet', label);
  const directHttpsCalls = collectCapabilityNodes(
    program,
    (node) => node.type === 'CallExpression'
      && node.callee.type === 'Identifier' && node.callee.name === 'httpsGet',
  );
  assert.equal(directHttpsCalls.length, 0, `${label} may not call the HTTPS boundary outside fetchExactCandidate`);
  const fetchCalls = collectCapabilityNodes(
    program,
    (node) => node.type === 'CallExpression'
      && node.callee.type === 'Identifier' && node.callee.name === 'fetchExactCandidate',
  );
  assert.equal(fetchCalls.length, 1, `${label} must have one governed candidate fetch call site`);
  const options = fetchCalls[0].arguments[1];
  assert.equal(options?.type, 'ObjectExpression', `${label} governed fetch options must be literal`);
  const httpsProperties = options.properties.filter(
    (property) => property.type === 'Property'
      && !property.computed && (property.key.name || property.key.value) === 'httpsGet',
  );
  assert.equal(httpsProperties.length, 1, `${label} governed fetch must receive httpsGet exactly once`);
  assert.equal(httpsProperties[0].value.type, 'Identifier', `${label} governed HTTPS binding must be named`);
  assert.equal(httpsProperties[0].value.name, 'httpsGet', `${label} governed HTTPS binding must be exact`);
}

function assertLocalReviewServerWriterBoundary(source, label) {
  assertNoCapabilities(source, NETWORK_WRITER_FORBIDDEN_CAPABILITIES, label);
  const counts = capabilityCounts(source, label);
  assert.equal(counts.network, 1, `${label} must have only its local HTTP server boundary`);
  assert.ok(counts.filesystem_write > 0, `${label} must write the local decision ledger`);
  const program = parseCapabilitySource(source, label);
  assertExactDefaultImport(program, 'node:http', 'http', label);
  const createServerCalls = collectCapabilityNodes(
    program,
    (node) => node.type === 'CallExpression'
      && node.callee.type === 'MemberExpression'
      && node.callee.object.type === 'Identifier' && node.callee.object.name === 'http'
      && staticMemberName(node.callee) === 'createServer',
  );
  assert.equal(createServerCalls.length, 1, `${label} must create exactly one HTTP server`);
  assert.equal(bindingInitializer(program, 'server', label), createServerCalls[0], `${label} server binding must be exact`);
  const listenCalls = collectCapabilityNodes(
    program,
    (node) => node.type === 'CallExpression'
      && node.callee.type === 'MemberExpression' && staticMemberName(node.callee) === 'listen',
  );
  assert.equal(listenCalls.length, 1, `${label} must have exactly one listener`);
  assert.equal(listenCalls[0].callee.object.type, 'Identifier', `${label} listener receiver must be named`);
  assert.equal(listenCalls[0].callee.object.name, 'server', `${label} only the governed server may listen`);
  assert.deepEqual(
    listenCalls[0].arguments.slice(0, 2).map((argument) => staticArgumentDescriptor(argument, `${label} listen`)),
    ['$PORT', '127.0.0.1'],
    `${label} listener must remain loopback-only`,
  );
  assert.ok(
    ['FunctionExpression', 'ArrowFunctionExpression'].includes(listenCalls[0].arguments[2]?.type),
    `${label} listener callback must remain inline`,
  );
  const dynamicHttpOrServerCalls = collectCapabilityNodes(
    program,
    (node) => node.type === 'CallExpression'
      && node.callee.type === 'MemberExpression'
      && node.callee.object.type === 'Identifier'
      && ['http', 'server'].includes(node.callee.object.name)
      && staticMemberName(node.callee) === null,
  );
  assert.equal(dynamicHttpOrServerCalls.length, 0, `${label} HTTP and server call sites must be static`);
  const serverMemberReferences = collectCapabilityNodes(
    program,
    (node) => node.type === 'MemberExpression'
      && node.object.type === 'Identifier' && node.object.name === 'server'
      && (staticMemberName(node) === 'listen' || staticMemberName(node) === null),
  );
  assert.deepEqual(serverMemberReferences, [listenCalls[0].callee], `${label} listener capability must not be extracted or computed`);
}

// The session-signing carve-out (LIVE_REQUEST_AUTHORIZATION_SESSION_SOURCES)
// permits the `signing` capability outright, because the scanner has no
// finer-grained notion of "signing" than one bucket covering both Web
// Crypto's crypto.subtle and Node's crypto module. The narrower guarantee
// the class exists to make -- signing ONLY through the ambient Web Crypto
// global, for the session HMAC -- is enforced here independently of the
// capability scan: Node's `crypto` module is the only way to reach
// crypto.sign/createSign/createPrivateKey/createVerify, none of which Web
// Crypto's ambient `crypto.subtle` exposes, so it must never be required.
function assertLiveRequestAuthorizationSessionBoundary(source, label) {
  assertNoCapabilities(source, LIVE_REQUEST_AUTHORIZATION_SESSION_FORBIDDEN_CAPABILITIES, label);
  assert.doesNotMatch(
    source,
    /require\(\s*['"](?:node:)?crypto['"]\s*\)/,
    `${label} may sign/verify only through the ambient Web Crypto global -- Node's crypto module must never be required`,
  );
}

// The signature-verification carve-out
// (PURE_PROPOSAL_SIGNATURE_VERIFICATION_SOURCES) permits `signing` outright
// for the same reason: the scan cannot distinguish crypto.verify from
// crypto.sign -- both are the one `signing` capability. The narrower
// guarantee -- verification only, a signature is consumed here, never
// produced -- is enforced independently: the production-side primitives
// (crypto.sign, crypto.createPrivateKey, crypto.createSign) must never
// appear in the source.
function assertPureProposalSignatureVerificationBoundary(source, label) {
  assertNoCapabilities(source, PURE_PROPOSAL_SIGNATURE_VERIFICATION_FORBIDDEN_CAPABILITIES, label);
  assert.doesNotMatch(
    source,
    /\bcrypto\.(?:sign|createPrivateKey|createSign)\s*\(/,
    `${label} may verify a signature but must never produce one`,
  );
}

test('every production source changed from the fixed Phase 1 base is classified exactly once', () => {
  assert.equal(git(['rev-parse', PHASE1_BASE_COMMIT]), PHASE1_BASE_COMMIT);
  const changedSources = mechanicallyDerivedChangedProductionSources();
  const inventory = classifyChangedProductionSources({ changedSources, existedAtBase });
  assert.equal(inventory.length, changedSources.length);
  assert.deepEqual(inventory.map((entry) => entry.path), changedSources);
  assert.ok(inventory.some((entry) => entry.classification === 'MODIFIED_PREEXISTING'));
  assert.deepEqual(new Set(inventory.map((entry) => entry.classification)), new Set([
    'PURE_PROPOSAL',
    'PURE_PROPOSAL_SIGNATURE_VERIFICATION',
    'LOCAL_ARTIFACT_WRITER',
    'RECORDED_PROVIDER_REPLAY_WRITER',
    'LIVE_MODEL_ADJUDICATION_RUN',
    'LIVE_MODEL_EXPERIMENT_RUN',
    'LIVE_MODEL_CLI_EXPERIMENT_RUN',
    'LIVE_EXTRACTION_ORCHESTRATOR',
    'READ_ONLY_GIT_INSPECTOR',
    'READ_ONLY_GIT_ARTIFACT_WRITER',
    'LOCAL_SUBPROCESS_ARTIFACT_WRITER',
    'REMOTE_GIT_REVIEW_INSPECTOR',
    'REMOTE_GIT_REVIEW_GATED_ARTIFACT_WRITER',
    'REMOTE_SOURCE_ADMISSION_WRITER',
    'LOCAL_REVIEW_SERVER_WRITER',
    'PRODUCTION_PATH_PURE_ANALYSIS',
    'LIVE_EXTRACTION_RUN',
    'LOCAL_DATABASE_PROOF',
    'LIVE_REQUEST_AUTHORIZATION',
    'LIVE_REQUEST_AUTHORIZATION_SESSION',
    'LIVE_REQUEST_AUTHORIZATION_CLIENT',
    'CONTAINED_ROUTE_REPAIR',
    'CONTAINED_ROUTE_REPAIR_GUARDED_FETCH',
    'MODIFIED_PREEXISTING',
  ]));
});

test('pure proposals and local artefact writers have their exact capability boundaries', () => {
  assert.ok(PURE_PROPOSAL_SOURCES.includes('lib/canonical-v2/antitrust-v1-surface-disposition.js'));
  assert.ok(PURE_PROPOSAL_SOURCES.includes('lib/canonical-v2/bd837f1d-financing-source-open-world-pin.js'));
  for (const source of [
    'lib/canonical-v2/derived-comparison.js',
    'lib/canonical-v2/native-producer/ioc-mechanic-resolution.js',
    'lib/canonical-v2/native-producer/prompt-budget-split-preflight.js',
    'lib/canonical-v2/native-producer/sole-remedy-resolution.js',
    'lib/canonical-v2/policy-successor-m1-adoption-binding.js',
    'scripts/reprocess/v1-apply-guard.js',
    'lib/canonical-v2/legacy-card-bridge.js',
    'lib/canonical-v2/seven-family-v1-preview-deal.js',
    'lib/canonical-v2/seven-family-v2-review-evidence.js',
    'components/review-v2/SevenFamilyV1Surface.jsx',
  ]) assert.ok(PURE_PROPOSAL_SOURCES.includes(source), source);
  for (const source of [
    'scripts/reprocess/v1-apply-backup.js',
    'scripts/reprocess/v1-apply-receipt.js',
    'scripts/reprocess/v1-apply-sequence.js',
    'scripts/stage-2y-structure-m7-v2-repair-work3-finalise.mjs',
  ]) assert.ok(LOCAL_ARTIFACT_WRITERS.includes(source), source);
  for (const source of Object.values(REQUIRED_AUTHORITY_BOUNDARY_CONTRACT_SOURCES)) {
    assert.ok(PURE_PROPOSAL_SOURCES.includes(source), source);
  }
  assert.equal(
    REQUIRED_AUTHORITY_BOUNDARY_CONTRACT_SOURCES.DARK_INTEGRATION_CURRENT_ENVIRONMENT_VERIFICATION,
    'lib/canonical-v2/dark-integration-preflight.js',
  );
  assert.equal(
    REQUIRED_AUTHORITY_BOUNDARY_CONTRACT_SOURCES.SUCCESSOR_M1_TRUSTED_CONTROLLER_VERIFICATION,
    'lib/canonical-v2/native-producer/durable-12-item-pilot-readiness.js',
  );
  assert.equal(
    REQUIRED_AUTHORITY_BOUNDARY_CONTRACT_SOURCES.GOVERNED_IDENTITY_LITERAL_KEY_REGISTRY_PATCH,
    'lib/canonical-v2/deal-identity-trusted-key-registry-proposal.js',
  );
  assert.ok(PURE_PROPOSAL_SOURCES.includes(REQUIRED_AUTHORITY_BOUNDARY_CONTRACT_SOURCES.SOURCE_INTAKE_TRUSTED_AUTHORITY_VERIFIER));
  for (const relativePath of PURE_PROPOSAL_SOURCES) {
    assertNoCapabilities(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'), PURE_FORBIDDEN_CAPABILITIES, relativePath);
  }
  for (const relativePath of LOCAL_ARTIFACT_WRITERS) {
    assertNoCapabilities(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'), LOCAL_WRITER_FORBIDDEN_CAPABILITIES, relativePath);
  }
  // The signature-verification source is deliberately not a member of
  // PURE_PROPOSAL_SOURCES -- see the dedicated test below. Asserted here
  // too so the split cannot silently regress back into one shared (and
  // then falsely all-signing-forbidden) array.
  assert.equal(PURE_PROPOSAL_SOURCES.includes('lib/canonical-v2/v1-output-routing-reconciliation-audit.js'), false);
});

test('recorded provider replay writers have their exact capability boundary', () => {
  assert.deepEqual(RECORDED_PROVIDER_REPLAY_WRITERS, ['scripts/stage-2y-corroboration-ladder.mjs']);
  for (const relativePath of RECORDED_PROVIDER_REPLAY_WRITERS) {
    const source = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
    assertNoCapabilities(source, RECORDED_PROVIDER_REPLAY_WRITER_FORBIDDEN_CAPABILITIES, relativePath);
    assert.ok(capabilityCounts(source).provider > 0, `${relativePath} must construct a replay provider`);
    assert.ok(capabilityCounts(source).filesystem_write > 0, `${relativePath} must write only local evidence`);
    assert.match(source, /createReplayClient\s*\(/, `${relativePath} must bind the provider to a committed recording`);
  }
});

test('live model adjudication runs have their exact capability boundary', () => {
  assert.deepEqual(LIVE_MODEL_ADJUDICATION_RUNS, ['scripts/stage-2y-f-terra-adjudication.mjs']);
  for (const relativePath of LIVE_MODEL_ADJUDICATION_RUNS) {
    const source = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
    assertNoCapabilities(source, LIVE_MODEL_ADJUDICATION_RUN_FORBIDDEN_CAPABILITIES, relativePath);
    assert.ok(capabilityCounts(source).provider > 0, `${relativePath} must construct the Terra client`);
    assert.ok(capabilityCounts(source).filesystem_write > 0, `${relativePath} must write local adjudication evidence`);
    assert.match(source, /createCodexCliClient\s*\(/, `${relativePath} must use the Codex CLI client`);
  }
});

test('live model experiment runs have their exact capability boundary', () => {
  assert.deepEqual(LIVE_MODEL_EXPERIMENT_RUNS, ['scripts/stage-2y-phase-b-model-experiment.mjs']);
  for (const relativePath of LIVE_MODEL_EXPERIMENT_RUNS) {
    const source = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
    assertNoCapabilities(source, LIVE_MODEL_EXPERIMENT_RUN_FORBIDDEN_CAPABILITIES, relativePath);
    const counts = capabilityCounts(source);
    assert.ok(counts.provider > 0, `${relativePath} must call a real model provider`);
    assert.ok(counts.external_process > 0, `${relativePath} must invoke the cross-vendor model CLI`);
    assert.ok(counts.filesystem_write > 0, `${relativePath} must write local experiment evidence`);
  }
});

test('direct-CLI live model experiment runs have their exact capability boundary', () => {
  assert.deepEqual(LIVE_MODEL_CLI_EXPERIMENT_RUNS, ['scripts/stage-2y-phase-b-v2-model-experiment.mjs']);
  for (const relativePath of LIVE_MODEL_CLI_EXPERIMENT_RUNS) {
    const source = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
    assertNoCapabilities(source, LIVE_MODEL_EXPERIMENT_RUN_FORBIDDEN_CAPABILITIES, relativePath);
    const counts = capabilityCounts(source);
    assert.equal(counts.provider, 0, `${relativePath} provider authority is bound by literal CLI calls below`);
    assert.ok(counts.external_process > 0, `${relativePath} must invoke model CLIs`);
    assert.ok(counts.filesystem_write > 0, `${relativePath} must write local experiment evidence`);
    assert.match(source, /processCall\(\s*['"]codex['"]/, `${relativePath} must invoke the Codex CLI`);
    assert.match(source, /processCall\(\s*['"]claude['"]/, `${relativePath} must invoke the Claude CLI`);
  }
});

test('live extraction orchestrators have their exact capability boundary', () => {
  assert.deepEqual(LIVE_EXTRACTION_ORCHESTRATORS, [
    'scripts/stage-2y-l-live-batch.mjs',
    'scripts/stage-2y-phase-b-sol-financing-continuation.mjs',
    'scripts/stage-2y-phase-b-sol-probe.mjs',
  ]);
  for (const relativePath of LIVE_EXTRACTION_ORCHESTRATORS) {
    const source = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
    assertNoCapabilities(source, LIVE_EXTRACTION_ORCHESTRATOR_FORBIDDEN_CAPABILITIES, relativePath);
    assert.ok(capabilityCounts(source).external_process > 0, `${relativePath} must invoke the contained live runner`);
    assert.ok(capabilityCounts(source).filesystem_write > 0, `${relativePath} must write local batch evidence`);
    assert.match(source, /canonical-v2-live-extraction-run\.mjs/, `${relativePath} must invoke the registered live extraction runner`);
  }
});

test('the pure proposal signature-verification source has its exact capability boundary', () => {
  assert.deepEqual(PURE_PROPOSAL_SIGNATURE_VERIFICATION_SOURCES, ['lib/canonical-v2/v1-output-routing-reconciliation-audit.js']);
  for (const relativePath of PURE_PROPOSAL_SIGNATURE_VERIFICATION_SOURCES) {
    const source = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
    assertPureProposalSignatureVerificationBoundary(source, relativePath);
    // Not vacuous: this file must actually exercise the one capability its
    // narrower boundary permits, or the distinction from PURE_PROPOSAL_
    // SOURCES above would be untested.
    assert.ok(capabilityCounts(source).signing > 0, `${relativePath} must exercise signing -- that is why it is not in PURE_PROPOSAL_SOURCES`);
    // And re-proves it is the verification side specifically, not merely
    // "some signing capability or other".
    assert.match(source, /\bcrypto\.(?:verify|createPublicKey)\s*\(/, `${relativePath} must actually verify a signature -- proving the carve-out is exercised, not unused slack`);
  }
});

test('production-path pure analysis sources are capability-free leaf modules', () => {
  assert.ok(PRODUCTION_PATH_PURE_ANALYSIS_SOURCES.includes('lib/agreement-revision-classifier.js'));
  for (const relativePath of PRODUCTION_PATH_PURE_ANALYSIS_SOURCES) {
    const source = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
    // The same full scan PURE_PROPOSAL gets, plus the leaf requirement. This
    // class is where live product logic goes, so it is the strictest of the
    // four, never a softer landing than the class it sits beside.
    assertNoCapabilities(source, PURE_FORBIDDEN_CAPABILITIES, relativePath);
    assertNoModuleDependencies(source, relativePath);
  }
});

test('live extraction run sources have their exact capability boundary', () => {
  assert.ok(LIVE_EXTRACTION_RUN_SOURCES.includes('scripts/canonical-v2-live-extraction-run.mjs'));
  for (const relativePath of LIVE_EXTRACTION_RUN_SOURCES) {
    const source = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
    assertNoCapabilities(source, LIVE_EXTRACTION_RUN_FORBIDDEN_CAPABILITIES, relativePath);
    const counts = capabilityCounts(source);
    assert.ok(counts.provider > 0, `${relativePath} must exercise a real provider call -- that is what distinguishes this class`);
    assert.ok(counts.external_process > 0, `${relativePath} must spawn its model CLI as an external process`);
    assert.ok(counts.filesystem_write > 0, `${relativePath} must write its run evidence to local files`);
  }
});

test('live request authorization sources have their exact capability boundary', () => {
  assert.ok(LIVE_REQUEST_AUTHORIZATION_SOURCES.includes('lib/auth/gate.js'));
  assert.ok(LIVE_REQUEST_AUTHORIZATION_SOURCES.includes('pages/api/auth/login.js'));
  // The session-token HMAC is deliberately not a member of this array --
  // see the dedicated test below for why, and phase1-authority-boundary-
  // inventory.js's LIVE_REQUEST_AUTHORIZATION_SESSION_SOURCES comment for
  // the reasoning. Asserted here too so the split cannot silently regress
  // back into one shared (and then falsely all-signing-forbidden) array.
  assert.equal(LIVE_REQUEST_AUTHORIZATION_SOURCES.includes('lib/auth/session.js'), false);
  for (const relativePath of LIVE_REQUEST_AUTHORIZATION_SOURCES) {
    const source = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
    assertNoCapabilities(source, LIVE_REQUEST_AUTHORIZATION_FORBIDDEN_CAPABILITIES, relativePath);
  }
});

test('the live request authorization session-signing source has its exact capability boundary', () => {
  assert.deepEqual(LIVE_REQUEST_AUTHORIZATION_SESSION_SOURCES, ['lib/auth/session.js']);
  for (const relativePath of LIVE_REQUEST_AUTHORIZATION_SESSION_SOURCES) {
    const source = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
    assertLiveRequestAuthorizationSessionBoundary(source, relativePath);
    // Not vacuous: this file must actually exercise the one capability its
    // narrower boundary permits, or the distinction from
    // LIVE_REQUEST_AUTHORIZATION_SOURCES above would be untested.
    assert.ok(capabilityCounts(source).signing > 0, `${relativePath} must exercise signing -- that is why it is not in LIVE_REQUEST_AUTHORIZATION_SOURCES`);
  }
});

test('the live request authorization client source has its exact capability boundary', () => {
  assert.deepEqual(LIVE_REQUEST_AUTHORIZATION_CLIENT_SOURCES, ['pages/login.js']);
  for (const relativePath of LIVE_REQUEST_AUTHORIZATION_CLIENT_SOURCES) {
    const source = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
    assertNoCapabilities(source, LIVE_REQUEST_AUTHORIZATION_CLIENT_FORBIDDEN_CAPABILITIES, relativePath);
    // Not vacuous: this file must actually exercise the one capability its
    // narrower boundary permits, or the distinction from
    // LIVE_REQUEST_AUTHORIZATION_SOURCES above would be untested.
    assert.ok(capabilityCounts(source).network > 0, `${relativePath} must exercise network -- that is why it is not in LIVE_REQUEST_AUTHORIZATION_SOURCES`);
  }
});

test('contained route repair sources have their exact capability boundary', () => {
  assert.ok(CONTAINED_ROUTE_REPAIR_SOURCES.includes('lib/broad-corpus/contained-routes/users.js'));
  // The guarded fetch is deliberately not a member of this array -- see the
  // dedicated test below. Asserted here too so the split cannot silently
  // regress back into one shared (and then falsely database-only) array.
  assert.equal(CONTAINED_ROUTE_REPAIR_SOURCES.includes('lib/broad-corpus/contained-routes/from-url-fetch.js'), false);
  const { BROAD_CORPUS_CONTAINED_ROUTE_FILES } = require('../lib/broad-corpus-containment');
  const liveRouteFiles = new Set(Object.values(BROAD_CORPUS_CONTAINED_ROUTE_FILES));
  for (const relativePath of CONTAINED_ROUTE_REPAIR_SOURCES) {
    const source = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
    assertNoCapabilities(source, CONTAINED_ROUTE_REPAIR_FORBIDDEN_CAPABILITIES, relativePath);
    // Not vacuous, and re-proves the property the class exists to record:
    // the repair must never itself be the live route file it repairs.
    assert.equal(liveRouteFiles.has(relativePath), false, `${relativePath} must not be one of the live, still-contained route files`);
  }
});

test('the contained route repair guarded-fetch source has its exact capability boundary', () => {
  assert.deepEqual(CONTAINED_ROUTE_REPAIR_GUARDED_FETCH_SOURCES, ['lib/broad-corpus/contained-routes/from-url-fetch.js']);
  const { BROAD_CORPUS_CONTAINED_ROUTE_FILES } = require('../lib/broad-corpus-containment');
  const liveRouteFiles = new Set(Object.values(BROAD_CORPUS_CONTAINED_ROUTE_FILES));
  for (const relativePath of CONTAINED_ROUTE_REPAIR_GUARDED_FETCH_SOURCES) {
    const source = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
    assertNoCapabilities(source, CONTAINED_ROUTE_REPAIR_GUARDED_FETCH_FORBIDDEN_CAPABILITIES, relativePath);
    // Not vacuous: this file must actually exercise the one capability its
    // narrower boundary permits, or the distinction from
    // CONTAINED_ROUTE_REPAIR_SOURCES above would be untested.
    assert.ok(capabilityCounts(source).network > 0, `${relativePath} must exercise network -- that is why it is not in CONTAINED_ROUTE_REPAIR_SOURCES`);
    // Re-proves the property the sibling class test records: the repair
    // must never itself be the live route file it repairs.
    assert.equal(liveRouteFiles.has(relativePath), false, `${relativePath} must not be one of the live, still-contained route files`);
  }
  // The class comment's safety claim -- "restricts to SEC domains and
  // revalidates every redirect hop" -- is not just the bare capability
  // name: drive the real exported guard against a battery of adversarial
  // hosts that mirror the original SSRF finding's shape (arbitrary external
  // host, wrong scheme, subdomain-confusable hosts, a cloud metadata
  // address), proving the network capability this class permits is only
  // ever reachable through this allowlist.
  // eslint-disable-next-line global-require
  const { isAllowedIngestUrl } = require('../lib/broad-corpus/contained-routes/from-url-fetch');
  for (const blocked of [
    'https://evil.example/',
    'http://sec.gov/', // right host, wrong scheme
    'https://sec.gov.evil.example/', // suffix-confusable host
    'https://evilsec.gov/', // suffix-confusable host, no separating dot
    'https://169.254.169.254/latest/meta-data/', // cloud metadata address
    'https://localhost/',
    'ftp://sec.gov/',
    'not a url',
  ]) {
    assert.equal(isAllowedIngestUrl(blocked), false, `${blocked} must be refused`);
  }
  for (const allowed of ['https://sec.gov/', 'https://www.sec.gov/', 'https://efts.sec.gov/']) {
    assert.equal(isAllowedIngestUrl(allowed), true, `${allowed} must be allowed`);
  }
});

test('read-only Git inspectors launch only whitelisted inspection commands', () => {
  assert.deepEqual(READ_ONLY_GIT_INSPECTORS, [
    'lib/canonical-v2/successor-m1-readiness-packet.js',
    'lib/canonical-v2/v1-render-capture-preflight.js',
    'lib/canonical-v2/marker-start-git-baseline.js',
    'scripts/stage-2y-structure-m5-preparation-validate.mjs',
    'scripts/stage-2y-structure-migration-validate.mjs',
    'scripts/stage-2y-structure-m7-v2-repair-work3-validate.mjs',
  ]);
  for (const relativePath of READ_ONLY_GIT_INSPECTORS) {
    assertReadOnlyGitInspector(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'), relativePath);
  }
});

test('read-only Git artefact writers have their exact capability boundary', () => {
  assert.deepEqual(READ_ONLY_GIT_ARTIFACT_WRITERS, [
    'scripts/ci/baseline-manifest-impact.js',
    'scripts/ci/baseline-checkpoint.js',
    'scripts/ci/expensive-check-checkpoint.mjs',
    'scripts/audit/canonical-v2-termination-render-diagnosis.mjs',
    'scripts/stage-2y-h-representation-topic-compare.mjs',
    'scripts/stage-2y-registry-substrate-replay.mjs',
    'scripts/stage-2y-context-compilation-m3-finalise.mjs',
    'scripts/stage-2y-context-compilation-shadow.mjs',
    'scripts/stage-2y-structure-analysis-m4-finalise.mjs',
    'scripts/stage-2y-structure-analysis-shadow.mjs',
    'scripts/stage-2y-structure-family-aggregate.mjs',
    'scripts/stage-2y-structure-m5-correct.mjs',
    'scripts/stage-2y-structure-m5-preparation-finalise.mjs',
    'scripts/stage-2y-structure-m6-project.mjs',
    'scripts/stage-2y-structure-m7-v2-repair-work0-finalise.mjs',
    'scripts/stage-2y-structure-m7-v2-repair-work0-validate.mjs',
    'scripts/stage-2y-structure-m7-v2-repair-work1-7-authority-validate.mjs',
    'scripts/stage-2y-structure-m7-v2-repair-work4-bind-candidate.mjs',
  ]);
  for (const relativePath of READ_ONLY_GIT_ARTIFACT_WRITERS) {
    const source = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
    if (relativePath === 'scripts/stage-2y-structure-m7-v2-repair-work4-bind-candidate.mjs') {
      assertWork4CandidateBinderBoundary(source, relativePath);
    } else {
      assertReadOnlyGitArtifactWriter(source, relativePath);
    }
  }
});

test('the execution-manifest validator delegates exactly its read-only Git inspection', () => {
  const relativePath =
    'scripts/stage-2y-structure-m7-v2-repair-execution-manifest-validate.mjs';
  const source = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
  assertExecutionManifestValidatorGitBoundary(source, relativePath);
  const seamImport = "import {\n  gitReadText,\n  validateWork3,\n} from './stage-2y-structure-m7-v2-repair-work3-validate.mjs';";
  assert.ok(source.includes(seamImport), 'validator must import the Work3 validator seam');
  for (const hostile of [
    source.replace(
      seamImport,
      `import { execFileSync } from 'node:child_process';\n${seamImport}`,
    ),
    source.replace(
      seamImport,
      "import { validateWork3 } from './stage-2y-structure-m7-v2-repair-work3-validate.mjs';\n"
        + 'function gitReadText(root, argv) { return String([root, argv]); }',
    ),
    source.replace(
      "gitReadText(root, ['cat-file', '-e', `${binding.commit}^{commit}`]);",
      "gitReadText(root, ['push']);",
    ),
    source.replace(
      "originCommit = gitReadText(root, ['rev-parse', `refs/remotes/origin/${BRANCH}`]);",
      "originCommit = gitReadText(root, ['rev-parse', process.env.WORK4_REF]);",
    ),
  ]) {
    assert.notEqual(hostile, source);
    assert.throws(
      () => assertExecutionManifestValidatorGitBoundary(
        hostile,
        'hostile execution-manifest validator',
      ),
    );
  }
});

test('the Work3 validator Git seam refuses any non-read-only command head', async () => {
  const { gitReadText } = await import(
    path.join(ROOT, 'scripts/stage-2y-structure-m7-v2-repair-work3-validate.mjs')
  );
  assert.equal(gitReadText(ROOT, ['rev-parse', '--is-inside-work-tree']), 'true');
  for (const argv of [['push', 'origin'], ['commit', '-m', 'x'], [], ['rev-parse', 7]]) {
    assert.throws(() => gitReadText(ROOT, argv), /GIT_READ_ONLY_SEAM/u);
  }
});

test('the Work4 candidate binder rejects unpinned history and ungoverned writes', () => {
  const relativePath =
    'scripts/stage-2y-structure-m7-v2-repair-work4-bind-candidate.mjs';
  const source = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
  for (const hostile of [
    source.replace(
      "execFileSync('git', argv, {",
      'execFileSync(process.env.WORK4_GIT, argv, {',
    ),
    source.replace(
      "head = gitRead(repoRoot, ['rev-parse', 'HEAD']);",
      "head = gitRead(repoRoot, ['push']);",
    ),
    source.replace(
      'sourceCommit: WORK3_COMMIT',
      'sourceCommit: process.env.WORK3_COMMIT',
    ),
    source.replace(
      'writeExclusive(repoRoot, MANIFEST_PATH, canonicalBytes(manifest));',
      'writeExclusive(repoRoot, process.env.WORK4_PATH, canonicalBytes(manifest));',
    ),
    source.replace(
      'writeExclusive(repoRoot, TRANSITION_AUTHORITY_PATH, transitionBytes);',
      'writeExclusive(repoRoot, process.env.WORK4_PATH, transitionBytes);',
    ),
    source.replace(
      'writeExclusive(repoRoot, TRANSITION_AUTHORITY_PATH, transitionBytes);',
      'writeExclusive(repoRoot, TRANSITION_AUTHORITY_PATH, transitionBytes);\n'
        + '  fs.writeFileSync(process.env.WORK4_PATH, transitionBytes);',
    ),
  ]) {
    assert.notEqual(hostile, source);
    assert.throws(
      () => assertWork4CandidateBinderBoundary(hostile, 'hostile Work4 binder'),
    );
  }
});

test('local subprocess artefact writers launch only governed Node children or Git status', () => {
  assert.deepEqual(LOCAL_SUBPROCESS_ARTIFACT_WRITERS, [
    'scripts/ci/run-unit-test-shard.js',
    'scripts/stage-2y-structure-m7-v2-repair-work1-recover.mjs',
    'scripts/stage-2y-structure-m7-v2-repair-work2-recover.mjs',
    'scripts/stage-2y-structure-m7-v2-termination-family-package-seal-receipt.mjs',
  ]);
  for (const relativePath of LOCAL_SUBPROCESS_ARTIFACT_WRITERS) {
    const source = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
    assertLocalSubprocessArtifactWriterBoundary(source, relativePath);
  }
});

test('the archived Work3 remote-review candidate has an exact read-only Git boundary', () => {
  assert.deepEqual(REMOTE_GIT_REVIEW_INSPECTORS, [
    'scripts/stage-2y-structure-m7-v2-work3-closure-amendment-candidate.mjs',
  ]);
  for (const relativePath of REMOTE_GIT_REVIEW_INSPECTORS) {
    const source = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
    assertRemoteGitReviewInspectorBoundary(source, relativePath);
  }
});

test('the Work3 review-gated application writer has an exact read-only Git boundary', () => {
  assert.deepEqual(REMOTE_GIT_REVIEW_GATED_ARTIFACT_WRITERS, [
    'scripts/stage-2y-structure-m7-v2-repair-work3-closure-apply.mjs',
  ]);
  for (const relativePath of REMOTE_GIT_REVIEW_GATED_ARTIFACT_WRITERS) {
    const source = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
    assertRemoteGitReviewGatedArtifactWriterBoundary(source, relativePath);
  }
});

test('the source-admission writer has an exact outbound HTTPS boundary', () => {
  assert.deepEqual(REMOTE_SOURCE_ADMISSION_WRITERS, [
    'scripts/stage-2y-generalisation-source-admit.mjs',
  ]);
  for (const relativePath of REMOTE_SOURCE_ADMISSION_WRITERS) {
    const source = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
    assertRemoteSourceAdmissionWriterBoundary(source, relativePath);
  }
});

test('the lawyer-review writer serves only on loopback', () => {
  assert.deepEqual(LOCAL_REVIEW_SERVER_WRITERS, [
    'scripts/stage-2y-m7-lawyer-review-server.mjs',
  ]);
  for (const relativePath of LOCAL_REVIEW_SERVER_WRITERS) {
    const source = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
    assertLocalReviewServerWriterBoundary(source, relativePath);
  }
});

test('new authority class boundaries reject dynamic argv and outbound-network bypasses', () => {
  const replaceExact = (source, before, after, label) => {
    assert.ok(source.includes(before), `${label} mutation anchor must exist`);
    return source.replace(before, after);
  };

  const runnerPath = 'scripts/ci/run-unit-test-shard.js';
  const runnerSource = fs.readFileSync(path.join(ROOT, runnerPath), 'utf8');
  const environmentSelectedLeadingRunnerArgv = replaceExact(
    runnerSource,
    "    ordinary: [\n      '--max-old-space-size=8192',",
    "    ordinary: [\n      process.env.UNIT_TEST_ARGV,",
    'environment-selected leading runner argv',
  );
  assert.throws(
    () => assertLocalSubprocessArtifactWriterBoundary(environmentSelectedLeadingRunnerArgv, runnerPath),
    /lane argv|argv must contain only static/,
  );
  const environmentSelectedRunnerArgv = replaceExact(
    runnerSource,
    "        startLane('ordinary', args.ordinary, ordinaryOutput, cwd),",
    "        startLane('ordinary', process.env.UNIT_TEST_ARGV ? args.work3 : args.ordinary, ordinaryOutput, cwd),",
    'environment-selected runner argv',
  );
  assert.throws(
    () => assertLocalSubprocessArtifactWriterBoundary(environmentSelectedRunnerArgv, runnerPath),
    /lane calls must be exact|startLane argument 2/,
  );
  const thirdRunnerCall = replaceExact(
    runnerSource,
    "        startLane('Work3', args.work3, work3Output, cwd),",
    "        startLane('Work3', args.work3, work3Output, cwd),\n        startLane('extra', args.ordinary, ordinaryOutput, cwd),",
    'third runner call',
  );
  assert.throws(
    () => assertLocalSubprocessArtifactWriterBoundary(thirdRunnerCall, runnerPath),
    /must call startLane exactly three times/,
  );
  const indirectRunnerSpawn = replaceExact(
    runnerSource,
    '  const args = buildLaneArguments(plan);',
    "  const args = buildLaneArguments(plan);\n  spawn.call(null, process.execPath, [process.env.CI_CHILD], { cwd, env: process.env, stdio: 'ignore' });",
    'indirect runner spawn',
  );
  assert.throws(
    () => assertLocalSubprocessArtifactWriterBoundary(indirectRunnerSpawn, runnerPath),
    /spawn reference count must be exact/,
  );
  const implicitArgumentsRunnerArgv = replaceExact(
    runnerSource,
    'function startLane(label, args, outputPath, cwd) {',
    "function startLane(label, args, outputPath, cwd) {\n  if (process.env.CI_CHILD) arguments[1].push(process.env.CI_CHILD);",
    'implicit arguments runner argv',
  );
  assert.throws(
    () => assertLocalSubprocessArtifactWriterBoundary(implicitArgumentsRunnerArgv, runnerPath),
    /arguments reference count must be exact/,
  );
  const shadowedRunnerArgumentBuilder = replaceExact(
    runnerSource,
    'async function runShard(shard, { cwd = process.cwd(), output = process.stdout } = {}) {',
    "async function runShard(shard, { cwd = process.cwd(), output = process.stdout, buildLaneArguments = () => ({ ordinary: [process.env.CI_CHILD], work3: [process.env.CI_CHILD] }) } = {}) {",
    'shadowed runner argument builder',
  );
  assert.throws(
    () => assertLocalSubprocessArtifactWriterBoundary(shadowedRunnerArgumentBuilder, runnerPath),
    /runShard signature must be exact|buildLaneArguments reference count must be exact/,
  );
  const mutatingRunnerArgumentBuilder = replaceExact(
    runnerSource,
    'function buildLaneArguments(plan) {\n  return {',
    "function buildLaneArguments(plan) {\n  plan.ordinaryFiles = [process.env.CI_CHILD];\n  return {",
    'mutating runner argument builder',
  );
  assert.throws(
    () => assertLocalSubprocessArtifactWriterBoundary(mutatingRunnerArgumentBuilder, runnerPath),
    /builder body must contain only its return/,
  );
  const liveEvalWithDeadRunnerSpawn = replaceExact(
    runnerSource,
    `    const child = spawn(process.execPath, args, {
      cwd,
      env: process.env,
      stdio: ['ignore', descriptor, descriptor],
    });`,
    `    const child = false
      ? spawn(process.execPath, args, {
        cwd,
        env: process.env,
        stdio: ['ignore', descriptor, descriptor],
      })
      : eval(process.env.CI_CHILD_SOURCE);`,
    'live eval with dead runner spawn',
  );
  assert.throws(
    () => assertLocalSubprocessArtifactWriterBoundary(liveEvalWithDeadRunnerSpawn, runnerPath),
    /source (?:byte length|SHA-256) must remain pinned/,
  );
  const shadowedRunnerProcess = replaceExact(
    runnerSource,
    'function startLane(label, args, outputPath, cwd) {',
    "function startLane(label, args, outputPath, cwd) {\n  const process = { execPath: globalThis.process.env.CI_CHILD, env: globalThis.process.env };",
    'shadowed runner process',
  );
  assert.throws(
    () => assertLocalSubprocessArtifactWriterBoundary(shadowedRunnerProcess, runnerPath),
    /source (?:byte length|SHA-256) must remain pinned/,
  );
  const mutatingRunnerPlan = replaceExact(
    runnerSource,
    '  const ordinaryFiles = assignOrdinaryFiles(files, shard);',
    "  const ordinaryFiles = assignOrdinaryFiles(files, shard);\n  ordinaryFiles.push(process.env.CI_CHILD);",
    'mutating runner plan',
  );
  assert.throws(
    () => assertLocalSubprocessArtifactWriterBoundary(mutatingRunnerPlan, runnerPath),
    /source (?:byte length|SHA-256) must remain pinned/,
  );

  const terminationPath = 'scripts/stage-2y-structure-m7-v2-termination-family-package-seal-receipt.mjs';
  const terminationSource = fs.readFileSync(path.join(ROOT, terminationPath), 'utf8');
  const dynamicNodeArgv = replaceExact(
    terminationSource,
    `  [
    '--test',
    '--test-name-pattern',
    'family package seal',
    'tests/stage-2y-structure-m7-v2-repair-work3.test.js',
  ],`,
    '  process.argv.slice(2),',
    'dynamic Node argv',
  );
  assert.throws(
    () => assertLocalSubprocessArtifactWriterBoundary(dynamicNodeArgv, terminationPath),
    /argv must be a literal array/,
  );
  const recoveryPath = 'scripts/stage-2y-structure-m7-v2-repair-work1-recover.mjs';
  const recoverySource = fs.readFileSync(path.join(ROOT, recoveryPath), 'utf8');
  const reassignedNodePath = replaceExact(
    recoverySource,
    'function runGovernedChild(root, repositoryPath, failureCode) {',
    'function runGovernedChild(root, repositoryPath, failureCode) {\n  repositoryPath = process.argv[2];',
    'reassigned governed child path',
  );
  assert.throws(
    () => assertLocalSubprocessArtifactWriterBoundary(reassignedNodePath, recoveryPath),
    /repositoryPath must never be reassigned/,
  );

  const remoteGitPath = REMOTE_GIT_REVIEW_INSPECTORS[0];
  const remoteGitSource = fs.readFileSync(path.join(ROOT, remoteGitPath), 'utf8');
  const dynamicGitArgv = replaceExact(
    remoteGitSource,
    "gitText(['show', '-s', '--format=%T', commitSha])",
    "gitText(['show', '-s', '--format=%T', commitSha, ...process.argv.slice(2)])",
    'dynamic Git argv',
  );
  assert.throws(
    () => assertRemoteGitReviewInspectorBoundary(dynamicGitArgv, remoteGitPath),
    /argv must not contain a spread/,
  );
  const unboundRemote = replaceExact(
    remoteGitSource,
    "const REVIEW_TARGET_ORIGIN_URL =\n  'https://github.com/CodeNameHash/precedent-machine.git';",
    "const REVIEW_TARGET_ORIGIN_URL = process.env.REVIEW_TARGET_ORIGIN_URL;\nconst DEAD_REVIEW_TARGET_ORIGIN_URL = 'https://github.com/CodeNameHash/precedent-machine.git';",
    'remote URL binding',
  );
  assert.throws(
    () => assertRemoteGitReviewInspectorBoundary(unboundRemote, remoteGitPath),
    /REVIEW_TARGET_ORIGIN_URL must be a literal/,
  );
  const rewrittenGitArgv = replaceExact(
    remoteGitSource,
    'function gitText(argv) {',
    "function gitText(argv) {\n  argv = ['ls-remote', process.env.REVIEW_TARGET_ORIGIN_URL];",
    'rewritten Git argv',
  );
  assert.throws(
    () => assertRemoteGitReviewInspectorBoundary(rewrittenGitArgv, remoteGitPath),
    /wrapper body must be exact|argv must never be reassigned/,
  );
  const extraRemoteFetch = `${remoteGitSource}\nglobalThis.fetch('https://evil.example');\n`;
  assert.throws(
    () => assertRemoteGitReviewInspectorBoundary(extraRemoteFetch, remoteGitPath),
    /exactly one pinned remote Git observation/,
  );
  const inspectorWrite = `${remoteGitSource}\nimport { writeFileSync } from 'node:fs';\nwriteFileSync('unexpected', 'write');\n`;
  assert.throws(
    () => assertRemoteGitReviewInspectorBoundary(inspectorWrite, remoteGitPath),
    /filesystem_write/,
  );
  const inspectorLowLevelWrite = `${remoteGitSource}\nimport { openSync, writeSync } from 'node:fs';\nconst hostileDescriptor = openSync('unexpected', 'w');\nwriteSync(hostileDescriptor, 'write');\n`;
  assert.throws(
    () => assertRemoteGitReviewInspectorBoundary(inspectorLowLevelWrite, remoteGitPath),
    /filesystem_write|node:fs import must be exact/,
  );
  const inspectorBareFsOpen = `${remoteGitSource}\nimport { openSync as hostileOpenSync } from 'fs';\nhostileOpenSync('unexpected', 'w');\n`;
  assert.throws(
    () => assertRemoteGitReviewInspectorBoundary(inspectorBareFsOpen, remoteGitPath),
    /node:fs import must be exact/,
  );
  const inspectorPromisesImport = `${remoteGitSource}\nimport { writeFile as hostileWriteFile } from 'node:fs/promises';\nhostileWriteFile('unexpected', 'write');\n`;
  assert.throws(
    () => assertRemoteGitReviewInspectorBoundary(inspectorPromisesImport, remoteGitPath),
    /filesystem_write|node:fs import must be exact/,
  );
  const inspectorFsRequire = `${remoteGitSource}\nconst hostileFs = require('fs');\nvoid hostileFs;\n`;
  assert.throws(
    () => assertRemoteGitReviewInspectorBoundary(inspectorFsRequire, remoteGitPath),
    /node:fs import must be exact/,
  );
  const inspectorExtraRead = `${remoteGitSource}\nreadFileSync('unexpected');\n`;
  assert.throws(
    () => assertRemoteGitReviewInspectorBoundary(inspectorExtraRead, remoteGitPath),
    /readFileSync call roster must be exact/,
  );

  const reviewGatedPath = REMOTE_GIT_REVIEW_GATED_ARTIFACT_WRITERS[0];
  const reviewGatedSource = fs.readFileSync(path.join(ROOT, reviewGatedPath), 'utf8');
  const dynamicApplicationGitArgv = replaceExact(
    reviewGatedSource,
    "git(root, ['cat-file', '-s', binding.git_blob_oid])",
    "git(root, ['cat-file', '-s', binding.git_blob_oid, ...process.argv.slice(2)])",
    'dynamic application Git argv',
  );
  assert.throws(
    () => assertRemoteGitReviewGatedArtifactWriterBoundary(
      dynamicApplicationGitArgv,
      reviewGatedPath,
    ),
    /argv must not contain a spread/,
  );
  const unboundApplicationRemote = replaceExact(
    reviewGatedSource,
    "const REVIEW_TARGET_ORIGIN_URL =\n  'https://github.com/CodeNameHash/precedent-machine.git';",
    "const REVIEW_TARGET_ORIGIN_URL = process.env.REVIEW_TARGET_ORIGIN_URL;\nconst DEAD_REVIEW_TARGET_ORIGIN_URL = 'https://github.com/CodeNameHash/precedent-machine.git';",
    'application remote URL binding',
  );
  assert.throws(
    () => assertRemoteGitReviewGatedArtifactWriterBoundary(
      unboundApplicationRemote,
      reviewGatedPath,
    ),
    /REVIEW_TARGET_ORIGIN_URL must be a literal/,
  );
  const rewrittenApplicationGitArgv = replaceExact(
    reviewGatedSource,
    'function git(root, argv, options = {}) {',
    "function git(root, argv, options = {}) {\n  argv = ['ls-remote', process.env.REVIEW_TARGET_ORIGIN_URL];",
    'rewritten application Git argv',
  );
  assert.throws(
    () => assertRemoteGitReviewGatedArtifactWriterBoundary(
      rewrittenApplicationGitArgv,
      reviewGatedPath,
    ),
    /wrapper body must be exact|argv must never be reassigned/,
  );
  const extraApplicationFetch = `${reviewGatedSource}\nglobalThis.fetch('https://evil.example');\n`;
  assert.throws(
    () => assertRemoteGitReviewGatedArtifactWriterBoundary(
      extraApplicationFetch,
      reviewGatedPath,
    ),
    /exactly one pinned remote Git observation/,
  );
  const disabledApplicationReview = replaceExact(
    reviewGatedSource,
    'function validatePinnedExternalReviewReceipt(',
    'function validatePinnedExternalReviewReceipt(...ignored) { return; }\nfunction disabledPinnedExternalReviewReceipt(',
    'disabled application review validator',
  );
  assert.throws(
    () => assertRemoteGitReviewGatedArtifactWriterBoundary(
      disabledApplicationReview,
      reviewGatedPath,
    ),
    /validatePinnedExternalReviewReceipt/,
  );
  const extraApplicationWrite = `${reviewGatedSource}\nimport { writeFileSync } from 'node:fs';\nwriteFileSync('unexpected', 'write');\n`;
  assert.throws(
    () => assertRemoteGitReviewGatedArtifactWriterBoundary(
      extraApplicationWrite,
      reviewGatedPath,
    ),
    /filesystem write|node:fs import must be exact/,
  );
  const extraApplicationOpen = `${reviewGatedSource}\nopenSync('unexpected', 'w');\n`;
  assert.throws(
    () => assertRemoteGitReviewGatedArtifactWriterBoundary(
      extraApplicationOpen,
      reviewGatedPath,
    ),
    /openSync call roster must be exact/,
  );
  const extraApplicationLowLevelWrite = `${reviewGatedSource}\nwriteSync(1, 'unexpected');\n`;
  assert.throws(
    () => assertRemoteGitReviewGatedArtifactWriterBoundary(
      extraApplicationLowLevelWrite,
      reviewGatedPath,
    ),
    /filesystem write capability count must be exact|writeSync call roster must be exact/,
  );
  const extraApplicationUnlink = `${reviewGatedSource}\nunlinkSync('unexpected');\n`;
  assert.throws(
    () => assertRemoteGitReviewGatedArtifactWriterBoundary(
      extraApplicationUnlink,
      reviewGatedPath,
    ),
    /filesystem write capability count must be exact|unlinkSync call roster must be exact/,
  );
  const falseGuardedApplicationReview = replaceExact(
    reviewGatedSource,
    '  validateHistoricalReview(root, amendment, reviewInput.record, reviewInput.bytes);',
    '  if (false) validateHistoricalReview(root, amendment, reviewInput.record, reviewInput.bytes);',
    'false-guarded application review',
  );
  assert.throws(
    () => assertRemoteGitReviewGatedArtifactWriterBoundary(
      falseGuardedApplicationReview,
      reviewGatedPath,
    ),
    /must call validateHistoricalReview as one direct top-level expression/,
  );
  const falseGuardedReceiptReview = replaceExact(
    reviewGatedSource,
    '  validatePinnedExternalReviewReceipt(\n    amendment,',
    '  if (false) validatePinnedExternalReviewReceipt(\n    amendment,',
    'false-guarded external receipt review',
  );
  assert.throws(
    () => assertRemoteGitReviewGatedArtifactWriterBoundary(
      falseGuardedReceiptReview,
      reviewGatedPath,
    ),
    /must call validatePinnedExternalReviewReceipt as one direct top-level expression/,
  );
  const earlyReturnReceiptReview = replaceExact(
    reviewGatedSource,
    '  observedReviewTargetCommitBinding,\n) {\n  const contract = amendment.external_review_receipt_contract;',
    '  observedReviewTargetCommitBinding,\n) {\n  return;\n  const contract = amendment.external_review_receipt_contract;',
    'early-return external receipt validator',
  );
  assert.throws(
    () => assertRemoteGitReviewGatedArtifactWriterBoundary(
      earlyReturnReceiptReview,
      reviewGatedPath,
    ),
    /validatePinnedExternalReviewReceipt body must remain exact|must not return before validation closes/,
  );
  const noOpFail = replaceExact(
    reviewGatedSource,
    'function fail(code, detail) {\n  throw new Work3ClosureApplicationError(code, detail);\n}',
    'function fail(code, detail) {\n  void code;\n  void detail;\n}',
    'no-op application failure path',
  );
  assert.throws(
    () => assertRemoteGitReviewGatedArtifactWriterBoundary(noOpFail, reviewGatedPath),
    /fail body must be exact|fail must throw/,
  );
  const withoutOriginalWrite = replaceExact(
    reviewGatedSource,
    '  writeOutputs(targets, applicationBytes, successorBytes);\n',
    '',
    'moved application write removal',
  );
  const writeBeforeReview = replaceExact(
    withoutOriginalWrite,
    '  validateHistoricalReview(root, amendment, reviewInput.record, reviewInput.bytes);',
    '  writeOutputs(targets, applicationBytes, successorBytes);\n  validateHistoricalReview(root, amendment, reviewInput.record, reviewInput.bytes);',
    'moved application write insertion',
  );
  assert.throws(
    () => assertRemoteGitReviewGatedArtifactWriterBoundary(writeBeforeReview, reviewGatedPath),
    /must close external review before writeOutputs/,
  );
  const retargetedSuccessor = replaceExact(
    reviewGatedSource,
    '`${CONTROL}/m7-v2-repair-work3-execution-manifest-closure-successor.json`;',
    '`${CONTROL}/unexpected-successor.json`;',
    'retargeted successor output',
  );
  assert.throws(
    () => assertRemoteGitReviewGatedArtifactWriterBoundary(
      retargetedSuccessor,
      reviewGatedPath,
    ),
    /SUCCESSOR_MANIFEST_PATH must remain pinned/,
  );
  const declaredThirdOutput = replaceExact(
    reviewGatedSource,
    'const REVIEW_TARGET_BRANCH =',
    "const THIRD_OUTPUT_PATH = `${CONTROL}/unexpected-third-output.json`;\nconst REVIEW_TARGET_BRANCH =",
    'third output declaration',
  );
  const preflightedThirdOutput = replaceExact(
    declaredThirdOutput,
    '[APPLICATION_RECEIPT_PATH, SUCCESSOR_MANIFEST_PATH].map(',
    '[APPLICATION_RECEIPT_PATH, SUCCESSOR_MANIFEST_PATH, THIRD_OUTPUT_PATH].map(',
    'third preflight output',
  );
  const mappedThirdOutput = replaceExact(
    preflightedThirdOutput,
    '    [SUCCESSOR_MANIFEST_PATH, successorBytes],\n  ]);',
    '    [SUCCESSOR_MANIFEST_PATH, successorBytes],\n    [THIRD_OUTPUT_PATH, successorBytes],\n  ]);',
    'third mapped output',
  );
  assert.throws(
    () => assertRemoteGitReviewGatedArtifactWriterBoundary(
      mappedThirdOutput,
      reviewGatedPath,
    ),
    /preflightOutputs must derive only the two output paths|writeOutputs must derive bytes only for the two output paths/,
  );

  const admissionPath = REMOTE_SOURCE_ADMISSION_WRITERS[0];
  const admissionSource = fs.readFileSync(path.join(ROOT, admissionPath), 'utf8');
  const aliasedHttpsCall = replaceExact(
    admissionSource,
    '  const authority = readJson(AUTHORITY_PATH);',
    "  const outbound = httpsGet; outbound('https://evil.example');\n  const authority = readJson(AUTHORITY_PATH);",
    'aliased HTTPS call',
  );
  assert.throws(
    () => assertRemoteSourceAdmissionWriterBoundary(aliasedHttpsCall, admissionPath),
    /only its governed HTTPS boundary/,
  );
  const reassignedHttpsBoundary = replaceExact(
    admissionSource,
    '  const authority = readJson(AUTHORITY_PATH);',
    "  httpsGet = globalThis.fetch;\n  const authority = readJson(AUTHORITY_PATH);",
    'reassigned HTTPS boundary',
  );
  assert.throws(
    () => assertRemoteSourceAdmissionWriterBoundary(reassignedHttpsBoundary, admissionPath),
    /httpsGet must never be reassigned/,
  );

  const serverPath = LOCAL_REVIEW_SERVER_WRITERS[0];
  const serverSource = fs.readFileSync(path.join(ROOT, serverPath), 'utf8');
  const aliasedHttpCall = replaceExact(
    serverSource,
    'const server = http.createServer',
    "const outbound = http.get; outbound('http://evil.example');\nconst server = http.createServer",
    'aliased HTTP call',
  );
  assert.throws(
    () => assertLocalReviewServerWriterBoundary(aliasedHttpCall, serverPath),
    /only its local HTTP server boundary/,
  );
  const secondListener = `${serverSource}\nhttp.createServer(() => {}).listen(PORT, '0.0.0.0');\n`;
  assert.throws(
    () => assertLocalReviewServerWriterBoundary(secondListener, serverPath),
    /must create exactly one HTTP server|must have exactly one listener/,
  );
  const extractedListener = replaceExact(
    serverSource,
    "server.listen(PORT, '127.0.0.1', () => {",
    "const listen = server.listen;\nlisten(PORT, '0.0.0.0', () => {",
    'extracted listener',
  );
  assert.throws(
    () => assertLocalReviewServerWriterBoundary(extractedListener, serverPath),
    /must have exactly one listener|listener capability must not be extracted/,
  );
});

test('modified pre-existing production sources do not add authority capabilities', () => {
  const inventory = classifyChangedProductionSources({
    changedSources: mechanicallyDerivedChangedProductionSources(),
    existedAtBase,
  });
  for (const entry of inventory.filter((item) => item.classification === 'MODIFIED_PREEXISTING')) {
    assertNoCapabilityGrowth(
      sourceAtBase(entry.path),
      fs.readFileSync(path.join(ROOT, entry.path), 'utf8'),
      entry.path,
    );
  }
});

test('the blocked capture compatibility surface cannot call any supplied boundary', async () => {
  let calls = 0;
  const hostileBoundary = new Proxy({}, { get() { calls += 1; throw new Error('boundary used'); } });
  await assert.rejects(
    captureDiscoveryRecords({
      records: hostileBoundary,
      artifactRoot: '/definitely/not/used',
      fetchImpl: hostileBoundary,
      fsImpl: hostileBoundary,
      db: hostileBoundary,
    }),
    /CONTROLLED_CAPTURE_EXECUTOR_UNAVAILABLE/,
  );
  assert.equal(calls, 0);
});

test('hostile inventory and capability changes fail closed', () => {
  const current = ['lib/new-pure.js'];
  const neverAtBase = () => false;
  assert.throws(
    () => classifyChangedProductionSources({ changedSources: [...current, 'lib/unclassified.js'], existedAtBase: neverAtBase, explicitClasses: { PURE_PROPOSAL: current } }),
    /UNCLASSIFIED_CHANGED_SOURCE: lib\/unclassified\.js/,
  );
  assert.throws(
    () => classifyChangedProductionSources({ changedSources: current, existedAtBase: neverAtBase, explicitClasses: { PURE_PROPOSAL: current, LOCAL_ARTIFACT_WRITER: current } }),
    /MULTIPLY_CLASSIFIED_CHANGED_SOURCE: lib\/new-pure\.js/,
  );
  assert.throws(
    () => classifyChangedProductionSources({ changedSources: current, existedAtBase: neverAtBase, explicitClasses: { PURE_PROPOSAL: [...current, 'lib/not-changed.js'] } }),
    /CLASSIFIED_SOURCE_NOT_CHANGED: lib\/not-changed\.js/,
  );
  assert.throws(
    () => classifyChangedProductionSources({ changedSources: current, existedAtBase: () => true, explicitClasses: { PURE_PROPOSAL: current } }),
    /PREEXISTING_SOURCE_EXPLICITLY_CLASSIFIED: lib\/new-pure\.js/,
  );
  assert.throws(() => assertNoCapabilities('fetch("https://example.invalid")', PURE_FORBIDDEN_CAPABILITIES, 'hostile pure'), /network/);
  assert.throws(() => assertNoCapabilities('createClient(url, key)', LOCAL_WRITER_FORBIDDEN_CAPABILITIES, 'hostile writer'), /database/);
  assert.throws(() => assertReadOnlyGitInspector("import { execFileSync } from 'node:child_process'; execFileSync('git', ['push'])", 'hostile inspector'), /non-read-only Git command/);
  assert.throws(() => assertReadOnlyGitArtifactWriter("import { execFileSync } from 'node:child_process'; execFileSync('git', ['push']); writeFileSync('evidence.json', '{}')", 'hostile Git writer'), /non-read-only Git command/);
  assert.throws(
    () => assertReadOnlyGitArtifactWriter(
      "import { execFileSync } from 'node:child_process'; import { writeFileSync } from 'node:fs'; function git(root, args) { return execFileSync('git', ['-C', root, ...args]); } git('/tmp/repo', ['add', '.']); writeFileSync('evidence.json', '{}');",
      'hostile Git -C writer',
    ),
    /non-read-only Git command/,
  );
  assert.throws(
    () => assertReadOnlyGitArtifactWriter(
      "import { execFileSync } from 'node:child_process'; import { writeFileSync } from 'node:fs'; function git(root, args) { return execFileSync('git', ['-C', root, ...args]); } const argv = ['status']; git('/tmp/repo', argv); writeFileSync('evidence.json', '{}');",
      'hostile dynamic Git writer',
    ),
    /literal array|declare Git commands/,
  );
  assert.throws(() => assertReadOnlyGitArtifactWriter("import { execFileSync, execSync } from 'node:child_process'; execSync('git status'); writeFileSync('evidence.json', '{}')", 'hostile alternate launcher'), /may import only execFileSync|may launch only the Git executable/);
  assert.throws(() => assertReadOnlyGitArtifactWriter("import { execFileSync } from 'node:child_process'; const launch = execFileSync; execFileSync('git', ['status']); launch('sh', ['-c', 'true']); writeFileSync('evidence.json', '{}')", 'hostile aliased launcher'), /child-process authority only for its literal Git launches/);
  assert.throws(() => assertReadOnlyGitArtifactWriter("const { execFileSync, execSync } = require('node:child_process'); execFileSync('git', ['status']); require('node:fs').writeFileSync('evidence.json', '{}')", 'hostile CommonJS alternate launcher'), /may import only execFileSync/);
  assert.throws(() => assertReadOnlyGitArtifactWriter("const { execFileSync: launch } = require('node:child_process'); launch('git', ['status']); require('node:fs').writeFileSync('evidence.json', '{}')", 'hostile CommonJS aliased launcher'), /may not alias execFileSync/);
  assert.throws(() => assertNoCapabilityGrowth('', 'fetch(url)', 'hostile legacy'), /network/);
  assert.throws(() => assertNoModuleDependencies("const fs = require('node:fs');", 'hostile analysis'), /no module dependencies/);
  assert.throws(() => assertNoModuleDependencies("import fs from 'node:fs';", 'hostile analysis'), /no module dependencies/);

  // The three narrow carve-outs added for lib/auth/session.js,
  // lib/broad-corpus/contained-routes/from-url-fetch.js and lib/canonical-v2/
  // v1-output-routing-reconciliation-audit.js must not silently become
  // "this whole capability is fine now": a hostile variant that reaches the
  // SAME permitted capability by a DIFFERENT, unreviewed route must still
  // fail, and every one of the other six capabilities must stay exactly as
  // forbidden as before.
  assert.throws(
    () => assertLiveRequestAuthorizationSessionBoundary(
      "const crypto = require('node:crypto');\nfunction sign(k, d) { return crypto.sign(null, d, k); }",
      'hostile session signer',
    ),
    /Node's crypto module must never be required/,
  );
  assert.throws(
    () => assertLiveRequestAuthorizationSessionBoundary("fetch('https://evil.example');", 'hostile session network'),
    /network/,
  );
  assert.throws(
    () => assertNoCapabilities('createClient(url, key)', CONTAINED_ROUTE_REPAIR_GUARDED_FETCH_FORBIDDEN_CAPABILITIES, 'hostile guarded fetch database'),
    /database/,
  );
  assert.throws(
    () => assertNoCapabilities('crypto.sign(null, data, privateKey);', CONTAINED_ROUTE_REPAIR_GUARDED_FETCH_FORBIDDEN_CAPABILITIES, 'hostile guarded fetch signing'),
    /signing/,
  );
  assert.throws(
    () => assertPureProposalSignatureVerificationBoundary(
      "const crypto = require('node:crypto');\ncrypto.sign(null, data, privateKey);",
      'hostile signature producer',
    ),
    /must never produce one/,
  );
  assert.throws(
    () => assertPureProposalSignatureVerificationBoundary(
      "const crypto = require('node:crypto');\ncrypto.createPrivateKey(pem);",
      'hostile private key generator',
    ),
    /must never produce one/,
  );
  assert.throws(
    () => assertPureProposalSignatureVerificationBoundary("fetch('https://evil.example');", 'hostile proposal network'),
    /network/,
  );
  // Moved 18 -> 23 with the later M7 mechanical tooling classes. This assertion
  // exists precisely so that adding an authority class cannot happen quietly.
  assert.equal(Object.keys(EXPLICIT_NEW_SOURCE_CLASSES).length, 23);
});

// ---------------------------------------------------------------------------------------
// Capability scanner: proves the three real holes the 2026-08-05 audit found are closed
// (Web Crypto signing, an unprefixed/renamed network binding, comment and string-literal
// text), that the scan fails closed on unparseable input rather than reading as clean,
// and that every capability the old text-matching scanner already caught is still caught.
// ---------------------------------------------------------------------------------------

test('low-level writeSync is detected without treating read-only openSync as a write', () => {
  const readOnly = capabilityCounts(
    "import { openSync } from 'node:fs';\nopenSync('input.json', 'r');",
    'read-only-open-sync.mjs',
  );
  const lowLevelWrite = capabilityCounts(
    "import { openSync, writeSync } from 'node:fs';\nconst descriptor = openSync('output.json', 'w');\nwriteSync(descriptor, 'output');",
    'low-level-write-sync.mjs',
  );
  assert.equal(readOnly.filesystem_write, 0);
  assert.equal(lowLevelWrite.filesystem_write, 1);
});

test('crypto.subtle signing is detected, including through a one-hop wrapper function', () => {
  // Direct crypto.subtle.sign/.verify -- Web Crypto, not Node's crypto.sign/.verify.
  assert.ok(capabilityCounts(
    'async function f(k, d) { return crypto.subtle.sign("HMAC", k, d); }',
    'direct-subtle-sign.js',
  ).signing > 0);
  assert.ok(capabilityCounts(
    'async function f(k, s, d) { return crypto.subtle.verify("HMAC", k, s, d); }',
    'direct-subtle-verify.js',
  ).signing > 0);
  // The exact real-world shape this control missed: lib/auth/session.js signs and
  // verifies through a local getSubtle() wrapper, never writing `crypto.subtle.sign(`
  // literally at the call site.
  const wrapperSource = `
    function getSubtle() {
      if (typeof crypto !== 'undefined' && crypto && crypto.subtle) return crypto.subtle;
      throw new Error('no subtle crypto');
    }
    async function sign(key, data) { return getSubtle().sign('HMAC', key, data); }
    async function verify(key, sig, data) { return getSubtle().verify('HMAC', key, sig, data); }
  `;
  const wrapperCounts = capabilityCounts(wrapperSource, 'wrapper-session.js');
  assert.equal(wrapperCounts.signing, 2, 'both the wrapped sign and verify calls must be traced');
  // Node's own crypto.sign/.verify/.createPrivateKey/.createVerify/.createPublicKey stay
  // covered too -- verify and createPublicKey were missing from the old pattern list
  // entirely (asymmetric with sign/createPrivateKey), found on a real file while building
  // this fix (lib/canonical-v2/v1-output-routing-reconciliation-audit.js).
  assert.ok(capabilityCounts("crypto.verify(null, data, key, sig);", 'node-verify.js').signing > 0);
  assert.ok(capabilityCounts("crypto.createPublicKey(pem);", 'node-create-public-key.js').signing > 0);
});

test('require("https") without the node: prefix, and a renamed require binding, are detected as network', () => {
  assert.ok(
    capabilityCounts("const https = require('https');", 'bare-https-require.js').network > 0,
    'require("https") with no node: prefix must itself be sufficient evidence, same as require("node:https") already was',
  );
  // The already-working prefixed form must still be caught -- this is the "same as"
  // half of the comparison above, made explicit rather than assumed.
  assert.ok(
    capabilityCounts("const https = require('node:https');", 'prefixed-https-require.js').network > 0,
    'require("node:https") must still be detected -- the case the old regex already covered',
  );
  // The exact real-world shape this control missed: lib/broad-corpus/contained-routes/
  // from-url-fetch.js requires https under its own name, then aliases it to a differently
  // named parameter (`{ httpsClient = https }`) before ever calling `.get(`.
  const renamedBindingSource = `
    const https = require('https');
    function fetchUrl(url, { httpsClient = https } = {}) {
      return httpsClient.get(url, () => {});
    }
  `;
  assert.ok(
    capabilityCounts(renamedBindingSource, 'renamed-https-binding.js').network > 0,
    'a renamed/aliased require("https") binding calling .get(...) must still be traced',
  );
  // node:child_process has the same bare-specifier gap as node:https; closed the same way.
  assert.ok(
    capabilityCounts("const cp = require('child_process'); cp.execSync('ls');", 'bare-child-process.js').external_process > 0,
  );
});

test('global fetch, aliased HTTP calls, and remote Git inspection are detected as network', () => {
  assert.equal(
    capabilityCounts("globalThis.fetch('https://evil.example')", 'global-fetch.js').network,
    1,
  );
  assert.equal(
    capabilityCounts(
      "import http from 'node:http'; const outbound = http.get; outbound('http://evil.example');",
      'aliased-http-get.js',
    ).network,
    2,
  );
  assert.equal(
    capabilityCounts(
      "import https from 'node:https'; const outbound = https.get; outbound('https://evil.example');",
      'aliased-https-get.js',
    ).network,
    2,
  );
  assert.equal(
    capabilityCounts(
      "import http from 'node:http'; const method = process.argv[2]; const outbound = http[method]; outbound('http://evil.example');",
      'dynamic-aliased-http-call.js',
    ).network,
    2,
  );
  assert.equal(
    capabilityCounts("const method = process.argv[2]; globalThis[method]('https://evil.example');", 'dynamic-global-call.js').network,
    1,
  );
  assert.equal(
    capabilityCounts(
      "import { execFileSync } from 'node:child_process'; function gitText(argv) { return execFileSync('git', argv); } gitText(['ls-remote', '--exit-code', 'https://example.invalid/repo.git', 'refs/heads/main']);",
      'remote-git-inspection.js',
    ).network,
    1,
  );
});

test('a capability name inside a comment or a string literal is not a match', () => {
  const commentOnly = capabilityCounts(
    "// calls getServiceSupabase() itself with no injection point\nfunction noop() { return 1; }",
    'comment-only.js',
  );
  assert.deepEqual(commentOnly, Object.fromEntries(CAPABILITY_NAMES.map((name) => [name, 0])));

  const blockCommentOnly = capabilityCounts(
    "/* fetch(url) is never called here; crypto.subtle.sign is not used either */\nfunction noop() { return 1; }",
    'block-comment-only.js',
  );
  assert.deepEqual(blockCommentOnly, Object.fromEntries(CAPABILITY_NAMES.map((name) => [name, 0])));

  const stringLiteralOnly = capabilityCounts(
    'const msg = "this calls getServiceSupabase() itself, see fetch() and crypto.subtle.sign";',
    'string-literal-only.js',
  );
  assert.equal(stringLiteralOnly.database, 0);
  assert.equal(stringLiteralOnly.network, 0);
  assert.equal(stringLiteralOnly.signing, 0);
});

test('an unparseable file fails closed rather than scanning as clean', () => {
  assert.throws(
    () => capabilityCounts('function( { [ * & ^ this is not JavaScript at all ~!@#', 'broken.js'),
    /UNPARSEABLE_SOURCE/,
  );
  // Must not be reachable through the assertion helpers either -- a broken file must never
  // silently read as "no forbidden capabilities present".
  assert.throws(
    () => assertNoCapabilities('function( { [ * & ^ broken', PURE_FORBIDDEN_CAPABILITIES, 'hostile broken'),
    /UNPARSEABLE_SOURCE/,
  );
});

test('valid CommonJS falls back to script grammar without weakening the capability scan', () => {
  const counts = capabilityCounts(
    "'use strict'; function requireNode() { return 1; } function requireNode() { return 2; }",
    'duplicate-commonjs-function.js',
  );
  assert.deepEqual(counts, Object.fromEntries(CAPABILITY_NAMES.map((name) => [name, 0])));
});

test('every capability the old text-matching scanner caught is still caught', () => {
  const positiveControls = {
    database: "const { data } = await db.from('deals').insert({ x: 1 });",
    network: 'fetch("https://example.invalid");',
    provider: "const p = createAnthropicProvider({ apiKey: 'x' });",
    signing: 'crypto.sign(null, data, privateKey);',
    deployment_or_activation: 'activate_candidate_release(candidateId);',
    external_process: "const { execFileSync } = require('node:child_process'); execFileSync('git', ['status']);",
    filesystem_write: "const fs = require('fs'); fs.writeFileSync('/tmp/x', 'y');",
  };
  for (const [capability, source] of Object.entries(positiveControls)) {
    const counts = capabilityCounts(source, `positive-control-${capability}.js`);
    assert.ok(counts[capability] > 0, `${capability} positive control must still be detected: ${source}`);
  }
  // The two phrase-based capabilities (SQL text, "vercel deploy") stay detected in literal
  // string/template content, exactly as the old scanner's raw-text match did.
  assert.ok(capabilityCounts('const q = "INSERT INTO logs VALUES (1)";', 'sql-literal.js').database > 0);
  assert.ok(capabilityCounts('const q = `DELETE FROM ${table} WHERE id = ${id}`;', 'sql-template.js').database > 0);
  assert.ok(capabilityCounts('const cmd = "npx vercel deploy --prod";', 'vercel-deploy-literal.js').deployment_or_activation > 0);
  assert.ok(capabilityCounts("import '@anthropic-ai/sdk';", 'anthropic-sdk-import.js').provider > 0);
  assert.ok(capabilityCounts("const { createClient } = require('@supabase/supabase-js'); createClient(url, key);", 'supabase-create-client.js').database > 0);
});
