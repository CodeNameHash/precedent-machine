const test = require('node:test');
const assert = require('node:assert/strict');
const {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');

const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  runInRestrictedContext,
} = require('../lib/canonical-v2/parser-runtime-sandbox');

const REPOSITORY_ROOT = resolve(__dirname, '..');
const SCRIPT = join(
  REPOSITORY_ROOT,
  'scripts/canonical-v2-parser-runtime-manifest.mjs',
);
const MANIFEST = join(
  REPOSITORY_ROOT,
  'lib/parser-v2/canonical-structural-definitions.manifest.json',
);
const EXPECTED_MODULE_PATHS = [
  'lib/edgar-cleanup.js',
  'lib/parser-v2/canonical-structural-definitions.js',
  'lib/parser-v2/coverage.js',
  'lib/parser-v2/detectors/defined-terms-toc.js',
  'lib/parser-v2/invariants/enacting-hard-wall.js',
  'lib/parser-v2/regions.js',
  'lib/parser-v2/regions/atomic.js',
  'lib/parser-v2/regions/backmatter.js',
  'lib/parser-v2/regions/definitions.js',
  'lib/parser-v2/regions/double-dummy.js',
  'lib/parser-v2/regions/preamble.js',
  'lib/parser-v2/structural.js',
  'lib/parser-v2/text-layers.js',
];

let runtimeManifest;

test.before(async () => {
  runtimeManifest = await import(
    '../scripts/canonical-v2-parser-runtime-manifest.mjs'
  );
});

test('checked-in parser runtime manifest passes exact closure verification', () => {
  const result = spawnSync(process.execPath, [SCRIPT, '--check'], {
    cwd: REPOSITORY_ROOT,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /^Verified parser runtime manifest with 13 modules\.\n$/);
});

test('manifest pins the exact sorted module closure, hashes, limits and identity', () => {
  const checkedIn = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  const rebuilt = runtimeManifest.buildParserRuntimeManifest({
    repositoryRoot: REPOSITORY_ROOT,
  });
  assert.deepEqual(checkedIn, rebuilt);
  assert.deepEqual(
    checkedIn.local_modules.map((module) => module.path),
    EXPECTED_MODULE_PATHS,
  );
  assert.deepEqual(checkedIn.governed_limits, {
    max_source_bytes: 4194304,
    max_sections: 4096,
    max_definitions: 16384,
    max_residuals: 4096,
    max_total_candidates: 16384,
    max_span_bytes: 2097152,
    max_envelope_bytes: 16777216,
    max_runtime_milliseconds: 5000,
  });
  for (const module of checkedIn.local_modules) {
    const bytes = readFileSync(join(REPOSITORY_ROOT, module.path));
    const digest = createHash('sha256').update(bytes).digest('hex');
    assert.equal(module.sha256, digest, module.path);
  }
  const {
    parser_runtime_manifest_id: manifestId,
    ...manifestBody
  } = checkedIn;
  assert.equal(
    manifestId,
    contentId('PARSER_V2_RUNTIME_MANIFEST/V1', manifestBody),
  );
});

test('manifest check rejects a tampered module digest', () => {
  const temporaryDirectory = mkdtempSync(
    join(tmpdir(), 'canonical-parser-manifest-'),
  );
  try {
    const tampered = JSON.parse(readFileSync(MANIFEST, 'utf8'));
    tampered.local_modules[0].sha256 = '0'.repeat(64);
    const tamperedManifest = join(temporaryDirectory, 'manifest.json');
    writeFileSync(
      tamperedManifest,
      `${JSON.stringify(tampered, null, 2)}\n`,
      'utf8',
    );
    assert.throws(
      () => runtimeManifest.checkParserRuntimeManifest({
        repositoryRoot: REPOSITORY_ROOT,
        manifestPath: tamperedManifest,
      }),
      /does not match the exact dependency closure/,
    );
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test('runtime closure contains no denied modules, tokens or dynamic loading', () => {
  const manifest = runtimeManifest.buildParserRuntimeManifest({
    repositoryRoot: REPOSITORY_ROOT,
  });
  for (const module of manifest.local_modules) {
    runtimeManifest.assertModulePathAllowed(module.path);
    if (!/\.(?:cjs|js|mjs)$/.test(module.path)) continue;
    const source = readFileSync(join(REPOSITORY_ROOT, module.path), 'utf8');
    runtimeManifest.assertSourceHasNoForbiddenAuthority(source, module.path);
    const specifiers = runtimeManifest.literalModuleSpecifiers(
      source,
      module.path,
    );
    assert.ok(
      specifiers.every((specifier) => (
        specifier.startsWith('./') || specifier.startsWith('../')
      )),
      module.path,
    );
  }
  assert.throws(
    () => runtimeManifest.literalModuleSpecifiers(
      'const dependency = require(moduleName);',
      'dynamic-require.js',
    ),
    /dynamic require/,
  );
  assert.throws(
    () => runtimeManifest.literalModuleSpecifiers(
      "const dependency = import('./runtime.js');",
      'dynamic-import.js',
    ),
    /dynamic import/,
  );
  assert.throws(
    () => runtimeManifest.assertModulePathAllowed(
      'lib/parser-v2/store-claims.js',
    ),
    /forbidden from the parser runtime/,
  );
  assert.throws(
    () => runtimeManifest.assertSourceHasNoForbiddenAuthority(
      "await fetch('https://example.invalid');",
      'network.js',
    ),
    /forbidden network invocation/,
  );
});

test('runtime rehashes executing bytes and removes aliased ambient authority', () => {
  const temporaryDirectory = mkdtempSync(
    join(tmpdir(), 'canonical-parser-sandbox-'),
  );
  const parserDirectory = join(temporaryDirectory, 'lib', 'parser-v2');
  mkdirSync(parserDirectory, { recursive: true });
  const entryPath = join(parserDirectory, 'canonical-structural-definitions.js');
  const layersPath = join(parserDirectory, 'text-layers.js');
  const entrySource = `module.exports = {
  detectStructuralDefinitionProposals() {
    const processAlias = globalThis['process'];
    const fetchAlias = globalThis['fetch'];
    let dynamicCodeAvailable = false;
    try {
      globalThis['Function']('return 1')();
      dynamicCodeAvailable = true;
    } catch (_) {}
    if (processAlias || fetchAlias || dynamicCodeAvailable) {
      throw new Error('ambient authority escaped');
    }
    return {
      schema_version: 'PARSER_V2_STRUCTURAL_DEFINITION_DETECTION/V1',
      sections: [],
      definitions: [],
      structural_residual_regions: [],
      candidate_failures: [],
      diagnostics: {}
    };
  }
};\n`;
  const layersSource = `module.exports = {
  buildLayers(rawText) {
    return {
      cleanText: rawText,
      mapCleanToRaw(index) { return index; }
    };
  }
};\n`;
  writeFileSync(entryPath, entrySource, 'utf8');
  writeFileSync(layersPath, layersSource, 'utf8');
  const digest = (source) => createHash('sha256').update(source).digest('hex');
  const manifest = {
    schema_version: 'PARSER_V2_RUNTIME_MANIFEST/V1',
    entry_module: 'lib/parser-v2/canonical-structural-definitions.js',
    local_modules: [
      {
        path: 'lib/parser-v2/canonical-structural-definitions.js',
        sha256: digest(entrySource),
      },
      {
        path: 'lib/parser-v2/text-layers.js',
        sha256: digest(layersSource),
      },
    ],
    governed_limits: {
      max_source_bytes: 4194304,
      max_sections: 4096,
      max_definitions: 16384,
      max_residuals: 4096,
      max_total_candidates: 16384,
      max_span_bytes: 2097152,
      max_envelope_bytes: 16777216,
      max_runtime_milliseconds: 5000,
    },
  };
  try {
    const output = runInRestrictedContext({
      manifest,
      repositoryRoot: temporaryDirectory,
      sourceText: 'source',
      limits: manifest.governed_limits,
    });
    assert.equal(output.detector_error, null);
    assert.deepEqual(output.capability_probe, {
      process: 'undefined',
      fetch: 'undefined',
      buffer: 'undefined',
      console: 'undefined',
      date: 'undefined',
      random: 'undefined',
      dynamic_code: 'UNAVAILABLE',
    });

    writeFileSync(entryPath, `${entrySource}\n// drift\n`, 'utf8');
    assert.throws(() => runInRestrictedContext({
      manifest,
      repositoryRoot: temporaryDirectory,
      sourceText: 'source',
      limits: manifest.governed_limits,
    }), /bytes do not match the manifest/);
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});
