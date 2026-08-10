'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
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
// require specifier or a computed member access (`obj['request']`) is invisible to static
// analysis, exactly as it was to the old regex; SQL and "vercel deploy" phrase detection
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
  sourceType: 'module',
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
  try {
    return acorn.parse(source, CAPABILITY_ACORN_OPTIONS);
  } catch {
    // Almost always JSX. Lower it and retry; if that still fails the module is opaque.
  }
  if (!sucrase) return null;
  try {
    const lowered = sucrase.transform(source, {
      transforms: ['jsx'],
      filePath: filePath || 'module.jsx',
      production: true,
    }).code;
    return acorn.parse(lowered, CAPABILITY_ACORN_OPTIONS);
  } catch {
    return null;
  }
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
  'rename', 'renameSync', 'unlink', 'unlinkSync', 'rm', 'rmSync',
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
const ALLOWED_GIT_COMMANDS = Object.freeze(new Set(['rev-parse', 'show', 'status']));
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
    if (node.type === 'MemberExpression' && !node.computed && node.property.type === 'Identifier') {
      return node.property.name;
    }
    return null;
  }

  function resolveValueTag(node) {
    if (!node) return undefined;
    if (node.type === 'Identifier') {
      if (valueTagOf.has(node.name)) return valueTagOf.get(node.name);
      if (node.name === 'crypto') return 'CRYPTO'; // Web Crypto / Node global, no import required
      if (HTTP_NAME_FALLBACK.has(node.name)) return 'HTTP_MODULE';
      if (FS_NAME_FALLBACK.has(node.name)) return 'FS_MODULE';
      return undefined;
    }
    if (node.type === 'MemberExpression' && !node.computed && node.property.type === 'Identifier') {
      const base = resolveValueTag(node.object);
      const prop = node.property.name;
      if (base === 'CRYPTO' && prop === 'subtle') return 'CRYPTO_SUBTLE';
      if (base === 'CRYPTO' && prop === 'webcrypto') return 'CRYPTO';
      if (base === 'FS_MODULE' && prop === 'promises') return 'FS_MODULE';
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
        if (FS_WRITE_METHODS.has(resolvedBareName)) hits.add('filesystem_write');
        if (CHILD_PROCESS_METHODS.has(resolvedBareName)) hits.add('external_process');
        const boundModule = canonicalModuleOf.get(callee.name);
        if ((resolvedBareName === 'sign' || resolvedBareName === 'verify')
          && (boundModule === 'crypto' || boundModule === 'node:crypto')) {
          hits.add('signing');
        }
      }

      if (callee.type === 'MemberExpression' && !callee.computed && callee.property.type === 'Identifier') {
        const propName = callee.property.name;
        const baseTag = resolveValueTag(callee.object);
        const objectName = callee.object.type === 'Identifier' ? callee.object.name : null;
        if ((baseTag === 'HTTP_MODULE' || (objectName && HTTP_NAME_FALLBACK.has(objectName))) && HTTP_METHODS.has(propName)) {
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

function extractedGitCommands(source) {
  const commands = [];
  const patterns = [
    /\bgit\([^,\n]+,\s*\[\s*['"]([^'"]+)['"]/g,
    /\bexecFileSync\(\s*['"]git['"]\s*,\s*\[\s*['"]([^'"]+)['"]/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) commands.push(match[1]);
  }
  return commands;
}

function assertReadOnlyGitCommands(source, label) {
  const processLaunches = source.match(/\bexecFileSync\s*\(/g) || [];
  const gitLaunches = source.match(/\b(?:[A-Za-z_$][\w$]*\.)?execFileSync\(\s*['"]git['"]/g) || [];
  assert.equal(processLaunches.length, gitLaunches.length, `${label} may launch only the Git executable`);
  assert.ok(processLaunches.length > 0, `${label} must contain an explicit Git inspection`);
  const commands = extractedGitCommands(source);
  assert.ok(commands.length > 0, `${label} must declare Git commands as literal array heads`);
  assert.deepEqual(commands.filter((command) => !ALLOWED_GIT_COMMANDS.has(command)), [], `${label} contains a non-read-only Git command`);
}

function assertLiteralExecFileGitCommands(source, label) {
  const childProcessSpecifiers = source.match(/['"](?:node:)?child_process['"]/g) || [];
  assert.equal(childProcessSpecifiers.length, 1, `${label} must import child-process authority exactly once`);
  assert.match(
    source,
    /import\s*\{\s*execFileSync\s*\}\s*from\s*['"]node:child_process['"]\s*;/,
    `${label} may import only execFileSync from node:child_process`,
  );
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
  ]) assert.ok(PURE_PROPOSAL_SOURCES.includes(source), source);
  for (const source of [
    'scripts/reprocess/v1-apply-backup.js',
    'scripts/reprocess/v1-apply-receipt.js',
    'scripts/reprocess/v1-apply-sequence.js',
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
  for (const relativePath of READ_ONLY_GIT_INSPECTORS) {
    assertReadOnlyGitInspector(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'), relativePath);
  }
});

test('read-only Git artefact writers have their exact capability boundary', () => {
  assert.deepEqual(READ_ONLY_GIT_ARTIFACT_WRITERS, [
    'scripts/audit/canonical-v2-termination-render-diagnosis.mjs',
    'scripts/stage-2y-registry-substrate-replay.mjs',
  ]);
  for (const relativePath of READ_ONLY_GIT_ARTIFACT_WRITERS) {
    assertReadOnlyGitArtifactWriter(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'), relativePath);
  }
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
  assert.throws(() => assertReadOnlyGitArtifactWriter("import { execFileSync, execSync } from 'node:child_process'; execSync('git status'); writeFileSync('evidence.json', '{}')", 'hostile alternate launcher'), /may import only execFileSync|may launch only the Git executable/);
  assert.throws(() => assertReadOnlyGitArtifactWriter("import { execFileSync } from 'node:child_process'; const launch = execFileSync; execFileSync('git', ['status']); launch('sh', ['-c', 'true']); writeFileSync('evidence.json', '{}')", 'hostile aliased launcher'), /child-process authority only for its literal Git launches/);
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
  // Moved 12 -> 18 with the Stage 2Y authority classes. This assertion
  // exists precisely so that adding an authority class cannot happen quietly.
  assert.equal(Object.keys(EXPLICIT_NEW_SOURCE_CLASSES).length, 18);
});

// ---------------------------------------------------------------------------------------
// Capability scanner: proves the three real holes the 2026-08-05 audit found are closed
// (Web Crypto signing, an unprefixed/renamed network binding, comment and string-literal
// text), that the scan fails closed on unparseable input rather than reading as clean,
// and that every capability the old text-matching scanner already caught is still caught.
// ---------------------------------------------------------------------------------------

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
