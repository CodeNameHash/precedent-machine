'use strict';

// Static import closure for the M7 V2 repair candidate registration.
//
// `registration_schema_extensions.import_closure_binding_required` on the
// candidate replacement authority requires a registration to bind not only the
// code roles it names but every repository module those roles can load. This
// module answers exactly that question and nothing else: given a repository
// root and a set of repository-relative entry modules, it returns the sorted,
// deduplicated set of repository-relative modules reachable through STATIC
// string specifiers, the entry modules included.
//
// It is pure: it reads the files it is asked about and returns a value. It
// writes nothing, calls no model, opens no socket and launches no process.
//
// What counts as an edge, and what does not:
//
// - `import … from '…'`, `export … from '…'`, `export * from '…'`,
//   `require('…')` and `import('…')` whose specifier is a single string
//   literal.
// - A bare specifier (`node:fs`, `next/dist/...`, a package name) leaves the
//   repository and is not a member. `node_modules` is never walked.
// - A relative specifier naming a file this tree does not contain is not a
//   member either: the closure binds the bytes that are here, and there are no
//   bytes to bind. Only an ENTRY module that cannot be read is refused, with
//   `IMPORT_CLOSURE_UNRESOLVED` naming it, because a bound code role that is
//   not there is a defect in the registration's own inputs.
// - A file whose text names no specifier is a leaf: it is a closure member,
//   its bytes are bound, and it contributes no edges. Bound roles are not all
//   JavaScript — the registration suite binds a placeholder test file whose
//   contents are a single line of prose.
// - A specifier assembled at runtime — `import(WORK3_FINALISER_PATH)`, a
//   template literal, a concatenation — is NOT an edge and is NOT a refusal
//   IN THIS MODULE. The spec this module implements asked for it to fail
//   registration naming the file and line. This walk cannot: the bound TEST
//   roles use the pattern themselves, and refusing it here, for every
//   closure member, would refuse every candidate registration.
//   `tests/stage-2y-structure-m7-v2-repair-work3.test.js:81` loads the Work 3
//   finaliser through `await import(WORK3_FINALISER_PATH)`, a path assembled
//   by `path.join` at line 42 of the same file; the same pattern appears
//   nineteen more times across the bound Work 2 and Work 3 test roles, and
//   `lib/review-parity/views.js:116` reaches a computed `require`. So the
//   closure is an under-approximation exactly where a specifier is not
//   statically knowable, and says so here rather than pretending otherwise.
//   Scoped review, 2026-09-04: none of those examples is one of the five
//   single-file compiler roles (`compiler`, `deterministic_generator`,
//   `contract_validator`, `projector`, `independent_verifier`), so
//   `stage-2y-structure-m7-v2-repair-register-candidate.mjs` separately
//   refuses a computed specifier found in the ENTRY TEXT of those five files
//   themselves (`IMPORT_CLOSURE_COMPUTED_SPECIFIER`) before it ever calls
//   into this walk. That refusal lives there, not here: this module still
//   never refuses one, for any path, because it cannot tell a compiler role
//   from any other entry module and does not try to.
//
// This is a static graph, not an execution trace: a `require` inside a branch
// that never runs is still an edge. That over-approximation is deliberate —
// the closure exists to bound what a bound role COULD load.
//
// The scan is textual, not a parse, and deliberately depends on nothing. The
// registrar is spawned inside prepared trees that contain no `node_modules`
// (`tests/stage-2y-structure-m7-v2-repair-execution-manifest.test.js`, the
// Work 4 bootstrap and correction CLI cases), so a parser dependency is not
// merely heavy, it is unavailable exactly where registration happens; and a
// closure that depended on one would differ between the process that
// registers and the process that verifies. So: match the four literal
// specifier forms in the text. A specifier named inside a comment or a string
// is matched too, and becomes a member if it resolves to a real file — an
// over-approximation in the same direction as the rest of this walk, and the
// same in every process, which is what the comparison needs.
//
// A separate, private walk with different rules lives in
// `lib/canonical-v2/native-producer/m3-family-parity-register.js`
// (`servedModuleClosure`). It is not reused here: it answers a different
// question about a different roster.

const fs = require('node:fs');
const path = require('node:path');

const RESOLUTION_EXTENSIONS = Object.freeze([
  '', '.js', '.mjs', '.cjs', '.json', '/index.js', '/index.mjs',
]);

class ImportClosureError extends Error {
  constructor(code, detail = '') {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'ImportClosureError';
    this.code = code;
  }
}

function fail(code, detail) {
  throw new ImportClosureError(code, detail);
}

function repositoryPath(value) {
  if (typeof value !== 'string' || value.length === 0
    || path.posix.isAbsolute(value) || value.includes('\\') || value.includes('\0')
    || value.split('/').some((part) => part.length === 0 || part === '.' || part === '..')
    || path.posix.normalize(value) !== value) {
    fail('IMPORT_CLOSURE_PATH', String(value));
  }
  return value;
}

function readSource(repoRoot, member) {
  const absolute = path.join(repoRoot, ...member.split('/'));
  let current = repoRoot;
  for (const part of member.split('/')) {
    current = path.join(current, part);
    let stat;
    try {
      stat = fs.lstatSync(current);
    } catch {
      return null;
    }
    if (stat.isSymbolicLink()) fail('IMPORT_CLOSURE_PATH', member);
  }
  const stat = fs.lstatSync(absolute);
  if (!stat.isFile()) return null;
  return fs.readFileSync(absolute, 'utf8');
}

// The four literal specifier forms: `from '…'`, a side-effect `import '…'`,
// `require('…')` and `import('…')`. A specifier assembled at runtime matches
// none of them and is not an edge; see the header.
const SPECIFIER_PATTERNS = Object.freeze([
  /\bfrom\s*(['"])([^'"\n\r]*)\1/g,
  /\bimport\s*(['"])([^'"\n\r]*)\1/g,
  /\brequire\s*\(\s*(['"])([^'"\n\r]*)\1\s*\)/g,
  /\bimport\s*\(\s*(['"])([^'"\n\r]*)\1\s*\)/g,
]);

function moduleSpecifiers(source) {
  const specifiers = [];
  for (const pattern of SPECIFIER_PATTERNS) {
    pattern.lastIndex = 0;
    let match = pattern.exec(source);
    while (match !== null) {
      if (match[2].length > 0) specifiers.push(match[2]);
      match = pattern.exec(source);
    }
  }
  return specifiers;
}

// A relative specifier that names a file in this tree is an edge. Anything
// else — a bare package or Node built-in specifier, or a relative specifier
// naming a file this tree does not contain — is not a member: the closure
// binds the modules that are here, and cannot bind bytes that do not exist.
function resolveSpecifier(repoRoot, member, specifier) {
  if (!specifier.startsWith('./') && !specifier.startsWith('../')) return null;
  const base = path.posix.join(path.posix.dirname(member), specifier);
  if (base.startsWith('..') || path.posix.isAbsolute(base)) return null;
  for (const extension of RESOLUTION_EXTENSIONS) {
    const candidate = `${base}${extension}`;
    if (candidate.split('/').includes('node_modules')) continue;
    const absolute = path.join(repoRoot, ...candidate.split('/'));
    let stat;
    try {
      stat = fs.lstatSync(absolute);
    } catch {
      continue;
    }
    if (stat.isFile()) return repositoryPath(candidate);
  }
  return null;
}

// The sorted, deduplicated transitive closure of `entryPaths`, entries
// included. Repository-relative paths only; `node_modules` and Node built-ins
// are never members.
function importClosure({ repoRoot, entryPaths } = {}) {
  if (typeof repoRoot !== 'string' || repoRoot.length === 0) {
    fail('IMPORT_CLOSURE_OPTIONS', 'repoRoot');
  }
  if (!Array.isArray(entryPaths) || entryPaths.length === 0) {
    fail('IMPORT_CLOSURE_OPTIONS', 'entryPaths');
  }
  const reachable = new Set();
  const pending = [...entryPaths].map(repositoryPath);
  while (pending.length > 0) {
    const member = pending.pop();
    if (reachable.has(member)) continue;
    if (member.split('/').includes('node_modules')) continue;
    const source = readSource(repoRoot, member);
    if (source === null) fail('IMPORT_CLOSURE_UNRESOLVED', member);
    reachable.add(member);
    if (member.endsWith('.json')) continue;
    for (const specifier of moduleSpecifiers(source)) {
      const resolved = resolveSpecifier(repoRoot, member, specifier);
      if (resolved !== null && !reachable.has(resolved)) pending.push(resolved);
    }
  }
  return [...reachable].sort();
}

module.exports = { ImportClosureError, importClosure };
