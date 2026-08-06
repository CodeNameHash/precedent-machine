#!/usr/bin/env node

/**
 * scripts/generate-codebase-inventory.js
 *
 * Derives, from the code itself, an inventory of the Canonical V2 / M3
 * pipeline layers named in docs/core/CODEBASE-GUIDE.md and
 * docs/core/GRAVEYARD.md: registered section families and their
 * producer prompts, product projection modules, the resolver's exported
 * handlers, review table configs, dark bridges, serving sources, and
 * live-run scripts.
 *
 * WHY THIS EXISTS. docs/codex-program/notes/doc-reality-audit.md found 28
 * cases of hand-written documentation asserting something about this
 * system that had gone stale or was wrong when written. Its conclusion:
 * prose cannot detect its own staleness; only something re-derived from
 * primary sources on every run can. This script is that mechanism for "what
 * exists and where" -- nothing in its output is hand-counted. Every number
 * is computed from the current working tree each time it runs.
 *
 * HOW TO REGENERATE. `npm run generate:codebase-inventory`, or
 * `node scripts/generate-codebase-inventory.js`. Commit the diff, if any.
 * `tests/codex-program-generated-docs.test.js` runs this generator in
 * `--check` mode on every `npm test` and fails the suite if the committed
 * output no longer matches a fresh run -- the same pattern
 * scripts/generate-query-serving-registry.js already uses for the same
 * reason.
 *
 * WHAT THIS SCRIPT DELIBERATELY DOES NOT DO. It does not judge whether a
 * module is "good", "dead", or "should be deleted" -- that judgement, with
 * its reasoning, lives in docs/core/GRAVEYARD.md, written by a
 * person (or an agent, reviewed) reading this data, not computed here. It
 * also does not read docs/codex-program/m3-family-parity-register.json or
 * duplicate it: that file (and lib/canonical-v2/native-producer/
 * m3-family-parity-register.js's liveProductVisibility()) already answers a
 * different question -- "is this product surface certified as reachable
 * from a served page" -- and re-derives its own answer the same way this
 * script does. This script answers "what files implement each pipeline
 * layer, and where", a structural map, not a certification register.
 *
 * DERIVATION METHOD, PER SECTION (also stated in each section's own
 * `method` field in the output, so the JSON is self-explaining without this
 * header):
 *
 *  - section_families: requires the real
 *    lib/canonical-v2/native-producer/producer-prompt-registry.js and calls
 *    its own listRegisteredSectionFamilies() for the authoritative family
 *    list, then parses that same file's source text (require() lines and
 *    its REGISTRY Map literal) to recover which producer-prompt module
 *    backs each family. The two are cross-checked against each other and
 *    this script throws if they disagree -- see assertFamilyRegistryAgrees.
 *  - product_projections / resolver / review_table_configs / dark_bridges /
 *    serving_sources: file-system glraduob (sic -- see note below) plus
 *    content inspection (export lists, require() targets) of the current
 *    working tree. No path is hand-typed as a "known" member of a category;
 *    each category is a filter over a real directory listing or a real
 *    content match (e.g. "requires ./dark-bridge-gate").
 *  - live_run_scripts: filename pattern over the real scripts/ directory
 *    listing, cross-checked against the narrower, hand-classified
 *    LIVE_EXTRACTION_RUN_SOURCES in
 *    lib/canonical-v2/phase1-authority-boundary-inventory.js (which only
 *    covers files added after that module's PHASE1_BASE_COMMIT -- see that
 *    file's own header) as a sanity check, not a source of truth.
 *
 * Consumer/reference lists throughout are computed with a single in-memory
 * scan of every tracked-extension source file under components/, pages/,
 * lib/, scripts/ and tests/ (readAllSourceFiles below), so a symbol search
 * is a regex test against already-read content, not a repeated shell-out.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const TARGET_PATH = path.join(REPO_ROOT, 'docs/codex-program/generated/system-inventory.json');
const PRODUCER_REGISTRY_PATH = path.join(REPO_ROOT, 'lib/canonical-v2/native-producer/producer-prompt-registry.js');
const CANDIDATE_RESOLUTION_PATH = path.join(REPO_ROOT, 'lib/canonical-v2/native-producer/candidate-resolution.js');
const CANONICAL_V2_DIR = path.join(REPO_ROOT, 'lib/canonical-v2');
const TABLE_CONFIGS_DIR = path.join(REPO_ROOT, 'components/review/table-configs');
const SCRIPTS_DIR = path.join(REPO_ROOT, 'scripts');
const SOURCE_SCAN_ROOTS = ['components', 'pages', 'lib', 'scripts', 'tests'];
const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.mjs']);
const EXCLUDED_DIR_NAMES = new Set(['node_modules', '.next', '.git', 'coverage']);

function toRepoRelative(absPath) {
  return path.relative(REPO_ROOT, absPath).split(path.sep).join('/');
}

function fail(message) {
  throw new Error(`generate-codebase-inventory: ${message}`);
}

// --- generic small parsers -------------------------------------------------

/** Returns the substring from `openBraceIndex` to its matching close brace, inclusive. */
function matchBalanced(src, openIndex, openChar, closeChar) {
  if (src[openIndex] !== openChar) fail(`expected '${openChar}' at index ${openIndex}`);
  let depth = 0;
  for (let i = openIndex; i < src.length; i += 1) {
    if (src[i] === openChar) depth += 1;
    else if (src[i] === closeChar) {
      depth -= 1;
      if (depth === 0) return src.slice(openIndex, i + 1);
    }
  }
  fail(`unbalanced '${openChar}'/'${closeChar}' starting at index ${openIndex}`);
  return '';
}

/**
 * Extracts the flat identifier list out of a `module.exports = { A, B, C };`
 * block (this codebase's consistent shorthand-export style in every file
 * this script reads). Strips `//` line comments first so an inline comment
 * between two export names cannot be mis-split into a fake identifier.
 * Throws if any resulting token is not a bare identifier, which is the
 * signal a file has moved to a different export shape this script has not
 * been taught -- fail loudly rather than emit a wrong inventory.
 */
function extractModuleExportsIdentifiers(absPath, src) {
  const marker = 'module.exports = {';
  const markerIndex = src.lastIndexOf(marker);
  if (markerIndex === -1) fail(`${toRepoRelative(absPath)}: no 'module.exports = {' found`);
  const openBrace = markerIndex + marker.length - 1;
  const block = matchBalanced(src, openBrace, '{', '}');
  const inner = block.slice(1, -1).replace(/\/\/[^\n]*/g, '');
  const tokens = inner.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
  for (const token of tokens) {
    if (!/^[A-Za-z_$][\w$]*$/.test(token)) {
      fail(`${toRepoRelative(absPath)}: module.exports contains a non-identifier export (${JSON.stringify(token)}); this script only understands flat shorthand exports`);
    }
  }
  return tokens;
}

// --- source tree scan, read once and reused for every consumer search -----

function walkDir(absDir, out) {
  for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
    if (EXCLUDED_DIR_NAMES.has(entry.name)) continue;
    const absPath = path.join(absDir, entry.name);
    if (entry.isDirectory()) {
      walkDir(absPath, out);
    } else if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      out.push(absPath);
    }
  }
  return out;
}

function readAllSourceFiles() {
  const files = [];
  for (const root of SOURCE_SCAN_ROOTS) {
    const absRoot = path.join(REPO_ROOT, root);
    if (fs.existsSync(absRoot)) walkDir(absRoot, files);
  }
  return files
    .map((absPath) => ({ path: toRepoRelative(absPath), content: fs.readFileSync(absPath, 'utf8') }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

function topLevelBucket(relPath) {
  const first = relPath.split('/')[0];
  return SOURCE_SCAN_ROOTS.includes(first) ? first : 'other';
}

function emptyBuckets() {
  return { components: [], pages: [], lib: [], scripts: [], tests: [], other: [] };
}

function totalReferenceCount(buckets) {
  return Object.values(buckets).reduce((sum, list) => sum + list.length, 0);
}

/**
 * A module's own basename, extension stripped, e.g.
 * 'lib/canonical-v2/antitrust-product-projection.js' -> 'antitrust-product-projection'.
 */
function moduleBasename(relPath) {
  return path.basename(relPath, path.extname(relPath));
}

/**
 * Reverse import index: for every scanned file, extracts every
 * require('...')/from '...' string literal, resolves it to a bare basename
 * (its last path segment, extension stripped -- resolution-independent, so
 * '../../../lib/canonical-v2/foo' and './foo' both resolve to 'foo'), and
 * records which files import a module ending in that basename. This is the
 * precise "who genuinely imports this file" primitive: it follows the real
 * module graph, so it cannot be fooled by two unrelated files coincidentally
 * declaring a same-named local constant (SOURCE, PROJECTION_SCHEMA and
 * similar generic names recur across many files in lib/canonical-v2/ as
 * per-file local constants, not shared imports -- a symbol-text search
 * would wrongly call every one of them a reference).
 */
function buildImportIndex(allFiles) {
  const importRe = /(?:require\(|from\s+)['"]([^'"]+)['"]/g;
  const importedBy = new Map(); // basename -> Set(files that import a module with this basename)
  const imports = new Map(); // file -> Set(basenames it imports)
  for (const file of allFiles) {
    let m = importRe.exec(file.content);
    while (m) {
      const target = m[1];
      if (target.startsWith('.')) {
        const basename = moduleBasename(target);
        if (!importedBy.has(basename)) importedBy.set(basename, new Set());
        importedBy.get(basename).add(file.path);
        if (!imports.has(file.path)) imports.set(file.path, new Set());
        imports.get(file.path).add(basename);
      }
      m = importRe.exec(file.content);
    }
    importRe.lastIndex = 0;
  }
  return { importedBy, imports };
}

/** The set of basenames `relPath` itself imports (a require()/from target's last path segment). */
function importedBasenamesOf(importIndex, relPath) {
  return importIndex.imports.get(relPath) || new Set();
}

/** Files that `require()`/`import` the module at `relPath`, by its basename, bucketed. */
function findImportersOfModule(importIndex, relPath) {
  const importers = importIndex.importedBy.get(moduleBasename(relPath)) || new Set();
  const buckets = emptyBuckets();
  for (const importerPath of importers) {
    if (importerPath === relPath) continue;
    buckets[topLevelBucket(importerPath)].push(importerPath);
  }
  for (const key of Object.keys(buckets)) buckets[key].sort();
  return buckets;
}

/**
 * Files whose raw text contains `needle` as a substring, other than
 * `excludeRelPath`. Deliberately text-based rather than import-graph-based:
 * this repo's client/server boundary (see CODEBASE-GUIDE.md's termination-
 * fee worked example) means some genuine cross-references are a comment
 * naming a server-only module's path, or a re-declared literal constant,
 * never an import -- an import-graph search would miss exactly those.
 * Only used where the needle is a long, specific basename unlikely to
 * collide (a per-family serving-source module name), never for short or
 * generic identifiers.
 */
function findFilesContainingSubstring(allFiles, needle, excludeRelPath) {
  const buckets = emptyBuckets();
  for (const file of allFiles) {
    if (file.path === excludeRelPath) continue;
    if (file.content.includes(needle)) buckets[topLevelBucket(file.path)].push(file.path);
  }
  for (const key of Object.keys(buckets)) buckets[key].sort();
  return buckets;
}

// --- section 1: registered section families and their producer prompts ----

function buildSectionFamilies() {
  // eslint-disable-next-line import/no-dynamic-require, global-require
  const registryModule = require(PRODUCER_REGISTRY_PATH);
  const liveFamilies = registryModule.listRegisteredSectionFamilies();
  const src = fs.readFileSync(PRODUCER_REGISTRY_PATH, 'utf8');

  const functionToModule = new Map();
  const requireRe = /const\s*\{\s*(\w+)\s*\}\s*=\s*require\('\.\/([\w-]+)'\);/g;
  let match = requireRe.exec(src);
  while (match) {
    functionToModule.set(match[1], `lib/canonical-v2/native-producer/${match[2]}.js`);
    match = requireRe.exec(src);
  }

  const registryMarker = 'const REGISTRY = new Map([';
  const registryStart = src.indexOf(registryMarker);
  if (registryStart === -1) fail('producer-prompt-registry.js: REGISTRY literal not found');
  const bracketOpen = src.indexOf('[', registryStart);
  const bracketBlock = matchBalanced(src, bracketOpen, '[', ']');
  const pairRe = /\['([A-Z0-9_]+)',\s*(\w+)\]/g;
  const parsedPairs = [];
  let pairMatch = pairRe.exec(bracketBlock);
  while (pairMatch) {
    parsedPairs.push({ family: pairMatch[1], fn: pairMatch[2] });
    pairMatch = pairRe.exec(bracketBlock);
  }

  const parsedFamilies = parsedPairs.map((p) => p.family).sort();
  const liveSorted = [...liveFamilies].sort();
  if (JSON.stringify(parsedFamilies) !== JSON.stringify(liveSorted)) {
    fail(`producer-prompt-registry.js: families parsed from source text (${parsedFamilies.join(',')}) disagree with listRegisteredSectionFamilies() (${liveSorted.join(',')})`);
  }

  const families = parsedPairs.map(({ family, fn }) => {
    const modulePath = functionToModule.get(fn);
    if (!modulePath) fail(`producer-prompt-registry.js: no require() found for producer function ${fn} (family ${family})`);
    const absModule = path.join(REPO_ROOT, modulePath);
    if (!fs.existsSync(absModule)) fail(`producer-prompt-registry.js: ${modulePath} (family ${family}) does not exist`);
    return { section_family: family, producer_function: fn, producer_prompt_module: modulePath };
  }).sort((a, b) => a.section_family.localeCompare(b.section_family));

  return {
    method: "require()s lib/canonical-v2/native-producer/producer-prompt-registry.js and calls listRegisteredSectionFamilies() for the family list; parses the same file's source text for the family -> producer module mapping; throws if the two disagree.",
    registry_source: 'lib/canonical-v2/native-producer/producer-prompt-registry.js',
    count: families.length,
    families,
  };
}

// --- section 2: product projection modules ---------------------------------

function buildProductProjections(allFiles, reverseImportIndex) {
  const fileNames = fs.readdirSync(CANONICAL_V2_DIR)
    .filter((name) => name.endsWith('-product-projection.js'))
    .sort();

  const modules = fileNames.map((name) => {
    const relPath = `lib/canonical-v2/${name}`;
    const absPath = path.join(CANONICAL_V2_DIR, name);
    const src = fs.readFileSync(absPath, 'utf8');
    const exportsList = extractModuleExportsIdentifiers(absPath, src).sort();
    const projectionEntryPoints = exportsList.filter((id) => /^project/.test(id));
    const importedBy = findImportersOfModule(reverseImportIndex, relPath);
    return {
      path: relPath,
      exports: exportsList,
      projection_entry_points: projectionEntryPoints,
      imported_by: importedBy,
      imported_outside_scripts_and_tests: importedBy.components.length > 0
        || importedBy.pages.length > 0
        || importedBy.lib.length > 0,
    };
  });

  return {
    method: "lists lib/canonical-v2/*-product-projection.js, extracts each file's module.exports identifiers (informational, listed in full), then resolves the real import graph (every require()/from target elsewhere in the tree that resolves to this file's own basename) to find genuine importers -- not a text search on export names, which this codebase's many same-named local constants (SOURCE, PROJECTION_SCHEMA, ...) would make unreliable. 'imported_outside_scripts_and_tests' means something other than a script or a test imports it -- i.e. it is reachable from product code.",
    glob: 'lib/canonical-v2/*-product-projection.js',
    count: modules.length,
    modules,
  };
}

// --- section 3: resolver handlers ------------------------------------------

function buildResolver() {
  const src = fs.readFileSync(CANDIDATE_RESOLUTION_PATH, 'utf8');
  const exportsList = extractModuleExportsIdentifiers(CANDIDATE_RESOLUTION_PATH, src).sort();
  if (!exportsList.includes('resolveCandidates')) {
    fail('candidate-resolution.js does not export resolveCandidates, the documented dispatch entry point');
  }
  const tables = exportsList.filter((id) => /(_TABLE|_LEXICON)$/.test(id));
  const helperFunctions = exportsList.filter((id) => /^[a-z]/.test(id));
  const otherConstants = exportsList.filter((id) => !tables.includes(id) && !helperFunctions.includes(id) && id !== 'resolveCandidates');

  return {
    method: "extracts module.exports identifiers from lib/canonical-v2/native-producer/candidate-resolution.js, the single module every registered family's proposals resolve through. 'tables' is every export ending _TABLE or _LEXICON (per-concept corroboration/lookup tables); 'helper_functions' is every export starting with a lowercase letter.",
    module: 'lib/canonical-v2/native-producer/candidate-resolution.js',
    dispatch_entry_point: 'resolveCandidates',
    total_exports: exportsList.length,
    tables: tables.sort(),
    helper_functions: helperFunctions.sort(),
    other_constants: otherConstants.sort(),
  };
}

// --- section 4: review table configs ---------------------------------------

function buildReviewTableConfigs() {
  const fileNames = fs.readdirSync(TABLE_CONFIGS_DIR)
    .filter((name) => name.endsWith('.config.js'))
    .sort();

  const configs = fileNames.map((name) => {
    const relPath = `components/review/table-configs/${name}`;
    const absPath = path.join(TABLE_CONFIGS_DIR, name);
    const src = fs.readFileSync(absPath, 'utf8');
    const importRe = /(?:from|require\()\s*['"]([^'"]*\/lib\/canonical-v2\/[^'"]*)['"]/g;
    const modules = new Set();
    let m = importRe.exec(src);
    while (m) {
      const normalised = m[1].replace(/^.*\/lib\/canonical-v2\//, 'lib/canonical-v2/');
      modules.add(normalised);
      m = importRe.exec(src);
    }
    const canonicalV2Modules = [...modules].sort();
    return {
      path: relPath,
      imports_canonical_v2: canonicalV2Modules.length > 0,
      canonical_v2_modules_imported: canonicalV2Modules,
    };
  });

  return {
    method: "lists components/review/table-configs/*.config.js and regexes each file's own import/require statements for a path containing /lib/canonical-v2/. A config with an empty canonical_v2_modules_imported list renders V1 data only as of this run (it may still receive V2 data server-side through a wire flag rather than a direct import -- see the termination-fees.config.js worked example in CODEBASE-GUIDE.md).",
    directory: 'components/review/table-configs',
    count: configs.length,
    configs,
  };
}

// --- section 5: dark bridges -------------------------------------------------

function buildDarkBridges(allFiles, importIndex) {
  const fileNames = fs.readdirSync(CANONICAL_V2_DIR).filter((name) => name.endsWith('.js')).sort();
  const gateRequirers = [];
  const contents = new Map();
  for (const name of fileNames) {
    const absPath = path.join(CANONICAL_V2_DIR, name);
    const src = fs.readFileSync(absPath, 'utf8');
    contents.set(name, src);
    if (/require\(['"]\.\/dark-bridge-gate['"]\)/.test(src)) gateRequirers.push(name);
  }
  if (gateRequirers.length === 0) fail("no lib/canonical-v2/*.js file requires './dark-bridge-gate' -- dark-bridge detection is broken or the mechanism was removed");
  const gateRequirerRelPaths = new Set(gateRequirers.map((name) => `lib/canonical-v2/${name}`));

  const leaves = [];
  const aggregators = [];
  for (const name of gateRequirers) {
    const relPath = `lib/canonical-v2/${name}`;
    const importedByThisFile = importedBasenamesOf(importIndex, relPath);
    const requiresAnotherGateRequirer = [...gateRequirerRelPaths]
      .some((other) => other !== relPath && importedByThisFile.has(moduleBasename(other)));
    const src = contents.get(name);
    const schemaMatch = src.match(/BRIDGE_SCHEMA\s*=\s*'([^']+)'/);
    const entry = { path: relPath, bridge_schema: schemaMatch ? schemaMatch[1] : null };
    if (requiresAnotherGateRequirer) aggregators.push(entry);
    else leaves.push(entry);
  }

  return {
    method: "finds every lib/canonical-v2/*.js file that requires ./dark-bridge-gate directly. Among those, a file that itself requires one or more OTHER such files is classed an aggregator (it composes several bridges, e.g. for the preview lane); the rest are leaf bridges (one bridge, one legacy-card-shaped product area).",
    gate_module: 'lib/canonical-v2/dark-bridge-gate.js',
    leaf_bridges: leaves.sort((a, b) => a.path.localeCompare(b.path)),
    aggregators: aggregators.sort((a, b) => a.path.localeCompare(b.path)),
  };
}

// --- section 6: serving sources ----------------------------------------------

function buildServingSources(allFiles) {
  const fileNames = fs.readdirSync(CANONICAL_V2_DIR).filter((name) => name.endsWith('.js')).sort();
  const perFamilyNames = fileNames.filter((name) => name.endsWith('-serving-source.js'));
  const perFamily = perFamilyNames.map((name) => {
    const relPath = `lib/canonical-v2/${name}`;
    const basename = name.replace('.js', '');
    // Substring, not import-graph: the wire-flag boundary (see
    // CODEBASE-GUIDE.md's termination-fee worked example) means client code
    // re-declares this server-only module's constants as literal strings
    // and names it only in a comment, rather than importing it -- an
    // import-graph search would miss exactly the cross-reference that
    // matters here. `basename` is long and specific (a per-family module
    // name), so a substring match is not at collision risk the way a short
    // symbol name would be.
    const referencingFiles = findFilesContainingSubstring(allFiles, basename, relPath);
    return {
      path: relPath,
      referenced_by: referencingFiles,
      reference_count: totalReferenceCount(referencingFiles),
    };
  });

  const genericInfrastructure = fileNames
    .filter((name) => /serving/i.test(name) && !name.endsWith('-serving-source.js'))
    .map((name) => `lib/canonical-v2/${name}`)
    .sort();

  return {
    method: "per_family_modules: lib/canonical-v2/*-serving-source.js, one per family that has reached the 'cheap pattern' rollout described in DECISIONS.md item 13 (compare against product_projections above -- a family can have a projection without yet having a serving source). generic_serving_infrastructure: every other lib/canonical-v2/*.js file with 'serving' in its name, listed without consumer analysis.",
    per_family_glob: 'lib/canonical-v2/*-serving-source.js',
    per_family_modules: perFamily,
    generic_serving_infrastructure: genericInfrastructure,
  };
}

// --- section 7: live-run scripts ---------------------------------------------

function buildLiveRunScripts() {
  const fileNames = fs.readdirSync(SCRIPTS_DIR)
    .filter((name) => name.includes('live-extraction-run') && name.endsWith('.mjs'))
    .sort();
  const scripts = fileNames.map((name) => `scripts/${name}`);

  // Sanity cross-check, not a source of truth: the one script this repo's
  // own Phase 1 governance register (see that file's header for why it is
  // narrower -- it only classifies sources added after its own base commit)
  // knows about must be among the ones this filename scan found.
  const boundaryInventory = require(path.join(REPO_ROOT, 'lib/canonical-v2/phase1-authority-boundary-inventory.js'));
  for (const knownPath of boundaryInventory.LIVE_EXTRACTION_RUN_SOURCES) {
    if (!scripts.includes(knownPath)) {
      fail(`phase1-authority-boundary-inventory.js lists ${knownPath} as a live-extraction-run source, but the scripts/*live-extraction-run*.mjs filename scan did not find it`);
    }
  }

  return {
    method: "lists scripts/*.mjs whose filename contains 'live-extraction-run'. Cross-checked (not sourced from) lib/canonical-v2/phase1-authority-boundary-inventory.js's LIVE_EXTRACTION_RUN_SOURCES, which only covers files added after that module's own base commit.",
    glob: "scripts/*live-extraction-run*.mjs",
    count: scripts.length,
    scripts,
  };
}

// --- layer locations (documentation, not derived data) ----------------------

const LAYER_LOCATIONS = Object.freeze({
  section_families_and_producer_prompts: 'lib/canonical-v2/native-producer/producer-prompt-registry.js (the dispatch seam) + one lib/canonical-v2/native-producer/*-producer-prompt.js per registered family.',
  resolver: 'lib/canonical-v2/native-producer/candidate-resolution.js (single module, all families).',
  write_set_assembly: 'lib/canonical-v2/native-producer/native-write-set-adapter.js (section-local -> document-absolute evidence) and lib/canonical-v2/validate-write-set.js (the write set shape every write must satisfy).',
  canonical_writer: 'lib/canonical-v2/canonical-writer.js, against the schema in supabase/canonical-v2-foundation.sql (see GRAVEYARD.md: unexecuted against a real database as of this writing).',
  product_projections: 'lib/canonical-v2/*-product-projection.js, one file per family or small family group.',
  dark_bridges: 'lib/canonical-v2/*-dark-bridge.js plus lib/canonical-v2/legacy-card-bridge.js (Material Contracts, despite its generic name), gated by lib/canonical-v2/dark-bridge-gate.js.',
  serving_sources: 'lib/canonical-v2/*-serving-source.js (per family, currently termination fees only) plus shared serving-layer modules named lib/canonical-v2/serving-*.js and lib/canonical-v2/*-serving-*.js.',
  review_rendering: 'components/review/table-configs/*.config.js (render logic, V1 and V2 both flow through these), consumed by components/review/ProvisionTable.jsx, itself rendered from pages/review/[id].js (the live production review page -- see CODEBASE-GUIDE.md for why pages/review-v2/[id].js is a redirect stub, not the V2 page).',
  live_run_scripts: 'scripts/*live-extraction-run*.mjs (human-invoked, one real model call per run, never scheduled or triggered by the product itself).',
  governance_and_status: 'docs/codex-program/m3-family-parity-register.json + lib/canonical-v2/native-producer/m3-family-parity-register.js (product-surface certification, a different question from this inventory -- see this file\'s own header).',
});

// --- assembly ------------------------------------------------------------

function buildInventory() {
  const allFiles = readAllSourceFiles();
  const importIndex = buildImportIndex(allFiles);
  const sectionFamilies = buildSectionFamilies();
  const productProjections = buildProductProjections(allFiles, importIndex);
  const resolver = buildResolver();
  const reviewTableConfigs = buildReviewTableConfigs();
  const darkBridges = buildDarkBridges(allFiles, importIndex);
  const servingSources = buildServingSources(allFiles);
  const liveRunScripts = buildLiveRunScripts();

  return {
    schema_version: 'M3_CODEBASE_INVENTORY/V1',
    generated_by: 'scripts/generate-codebase-inventory.js',
    regenerate_with: 'npm run generate:codebase-inventory',
    staleness_check: 'tests/codex-program-generated-docs.test.js (npm test) runs the generator in --check mode and fails if this file does not match a fresh run.',
    not_included_on_purpose: 'No timestamp, commit hash, or other value that would change without a corresponding change to one of the source files this script actually reads -- see this script\'s own header for why.',
    summary: {
      section_families: sectionFamilies.count,
      product_projection_modules: productProjections.count,
      resolver_exports: resolver.total_exports,
      review_table_configs: reviewTableConfigs.count,
      dark_bridge_leaves: darkBridges.leaf_bridges.length,
      dark_bridge_aggregators: darkBridges.aggregators.length,
      per_family_serving_sources: servingSources.per_family_modules.length,
      live_run_scripts: liveRunScripts.count,
    },
    section_families: sectionFamilies,
    product_projections: productProjections,
    resolver,
    review_table_configs: reviewTableConfigs,
    dark_bridges: darkBridges,
    serving_sources: servingSources,
    live_run_scripts: liveRunScripts,
    layer_locations: LAYER_LOCATIONS,
  };
}

function serialize(inventory) {
  return `${JSON.stringify(inventory, null, 2)}\n`;
}

function generate({ check = false } = {}) {
  const output = serialize(buildInventory());
  const current = fs.existsSync(TARGET_PATH) ? fs.readFileSync(TARGET_PATH, 'utf8') : null;
  if (check) {
    if (current !== output) {
      throw new Error('docs/codex-program/generated/system-inventory.json is stale. Run npm run generate:codebase-inventory and commit the diff.');
    }
    return { changed: false, bytes: Buffer.byteLength(output) };
  }
  if (current !== output) fs.writeFileSync(TARGET_PATH, output);
  return { changed: current !== output, bytes: Buffer.byteLength(output) };
}

if (require.main === module) {
  try {
    const result = generate({ check: process.argv.includes('--check') });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  REPO_ROOT,
  TARGET_PATH,
  generate,
  buildInventory,
};
