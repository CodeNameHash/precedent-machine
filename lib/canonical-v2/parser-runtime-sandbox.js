const { createHash } = require('node:crypto');
const {
  lstatSync,
  readFileSync,
  realpathSync,
} = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const REPOSITORY_ROOT = path.resolve(__dirname, '../..');

function sha256Hex(value) {
  return createHash('sha256').update(value).digest('hex');
}

function resolveRuntimeModules(manifest, repositoryRoot) {
  const root = realpathSync(repositoryRoot);
  const rootPrefix = `${root}${path.sep}`;
  return manifest.local_modules.map((entry) => {
    const requested = path.resolve(root, entry.path);
    const actual = realpathSync(requested);
    if (!actual.startsWith(rootPrefix)
      || !lstatSync(actual).isFile()
      || path.relative(root, actual).split(path.sep).join('/') !== entry.path) {
      throw new Error(`parser runtime module escapes its governed root: ${entry.path}`);
    }
    const bytes = readFileSync(actual);
    if (sha256Hex(bytes) !== entry.sha256) {
      throw new Error(`parser runtime module bytes do not match the manifest: ${entry.path}`);
    }
    const source = bytes.toString('utf8');
    if (!Buffer.from(source, 'utf8').equals(bytes)) {
      throw new Error(`parser runtime module is not valid UTF-8: ${entry.path}`);
    }
    return { path: entry.path, source };
  });
}

function commonJsSource(moduleEntry) {
  const exportedFunctions = [];
  const source = moduleEntry.source.replace(
    /^export\s+function\s+([A-Za-z_$][A-Za-z0-9_$]*)/gm,
    (_, name) => {
      exportedFunctions.push(name);
      return `function ${name}`;
    },
  );
  if (/^\s*(?:export|import)\b/m.test(source)) {
    throw new Error(`parser runtime module uses unsupported module syntax: ${moduleEntry.path}`);
  }
  if (exportedFunctions.length === 0) return source;
  return `${source}
module.exports = { ${exportedFunctions.join(', ')} };`;
}

function factoryAssignment(moduleEntry) {
  if (moduleEntry.path.endsWith('.json')) {
    return `__factories[${JSON.stringify(moduleEntry.path)}] = function(module) {
module.exports = ${moduleEntry.source.trim()};
};`;
  }
  return `__factories[${JSON.stringify(moduleEntry.path)}] = function(module, exports, require) {
${commonJsSource(moduleEntry)}
};`;
}

function runtimeProgram(modules, entryModule) {
  const factories = modules.map(factoryAssignment).join('\n');
  return `'use strict';
globalThis.process = undefined;
globalThis.fetch = undefined;
globalThis.XMLHttpRequest = undefined;
globalThis.WebSocket = undefined;
globalThis.Buffer = undefined;
globalThis.console = undefined;
globalThis.setTimeout = undefined;
globalThis.setInterval = undefined;
globalThis.setImmediate = undefined;
globalThis.queueMicrotask = undefined;
globalThis.Date = undefined;
Math.random = undefined;
const __factories = Object.create(null);
${factories}
const __cache = Object.create(null);
function __normalise(parts) {
  const out = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (out.length === 0) throw new Error('module path escaped runtime root');
      out.pop();
    } else {
      out.push(part);
    }
  }
  return out.join('/');
}
function __dirname(modulePath) {
  const index = modulePath.lastIndexOf('/');
  return index < 0 ? '' : modulePath.slice(0, index);
}
function __resolve(fromModule, specifier) {
  if (typeof specifier !== 'string'
    || (!specifier.startsWith('./') && !specifier.startsWith('../'))) {
    throw new Error('parser runtime requested an ungoverned module');
  }
  const base = __normalise((__dirname(fromModule) + '/' + specifier).split('/'));
  const candidates = [base, base + '.js', base + '.cjs', base + '.json',
    base + '/index.js', base + '/index.cjs', base + '/index.json'];
  for (const candidate of candidates) {
    if (Object.prototype.hasOwnProperty.call(__factories, candidate)) return candidate;
  }
  throw new Error('parser runtime requested a module outside its exact closure');
}
function __load(modulePath) {
  if (Object.prototype.hasOwnProperty.call(__cache, modulePath)) {
    return __cache[modulePath].exports;
  }
  const factory = __factories[modulePath];
  if (typeof factory !== 'function') throw new Error('parser runtime module is unavailable');
  const module = { exports: {} };
  __cache[modulePath] = module;
  const localRequire = (specifier) => __load(__resolve(modulePath, specifier));
  factory(module, module.exports, localRequire);
  return module.exports;
}
const __detector = __load(${JSON.stringify(entryModule)});
const __layersModule = __load('lib/parser-v2/text-layers.js');
function __intervals(detected) {
  const intervals = [];
  for (const row of detected.sections || []) intervals.push(row);
  for (const row of detected.definitions || []) intervals.push(row);
  for (const row of detected.structural_residual_regions || []) intervals.push(row);
  for (const row of detected.candidate_failures || []) intervals.push(row);
  return intervals;
}
globalThis.__parserApi = Object.freeze({
  capabilityProbe() {
    let dynamicCode = 'AVAILABLE';
    try {
      Function('return 1')();
    } catch (_) {
      dynamicCode = 'UNAVAILABLE';
    }
    return {
      process: typeof process,
      fetch: typeof fetch,
      buffer: typeof Buffer,
      console: typeof console,
      date: typeof Date,
      random: typeof Math.random,
      dynamic_code: dynamicCode,
    };
  },
  run(rawText, limits) {
    const layers = __layersModule.buildLayers(rawText);
    let detected = null;
    let detectorError = null;
    try {
      detected = __detector.detectStructuralDefinitionProposals(layers.cleanText, limits);
    } catch (error) {
      detectorError = error && error.name === 'RangeError'
        ? 'GOVERNED_LIMIT_EXCEEDED'
        : 'PARSER_EXECUTION_FAILED';
    }
    const cleanToRaw = new Uint32Array(layers.cleanText.length + 1);
    for (let index = 0; index < cleanToRaw.length; index += 1) {
      cleanToRaw[index] = layers.mapCleanToRaw(index);
    }
    const invalidRoundTrips = [];
    if (detected) {
      const seen = new Set();
      for (const row of __intervals(detected)) {
        const start = row.clean_start;
        const end = row.clean_end;
        if (!Number.isInteger(start) || !Number.isInteger(end)
          || start < 0 || end <= start || end > layers.cleanText.length) continue;
        const key = start + ':' + end;
        if (seen.has(key)) continue;
        seen.add(key);
        const rawStart = cleanToRaw[start];
        const rawEnd = cleanToRaw[end];
        const projected = __layersModule.buildLayers(rawText.slice(rawStart, rawEnd)).cleanText;
        if (projected !== layers.cleanText.slice(start, end)) {
          invalidRoundTrips.push(key);
        }
      }
    }
    invalidRoundTrips.sort();
    return {
      clean_text: layers.cleanText,
      clean_to_raw: cleanToRaw,
      detected,
      detector_error: detectorError,
      invalid_roundtrip_intervals: invalidRoundTrips,
    };
  },
});`;
}

function createRestrictedContext(modules, entryModule) {
  const sandbox = Object.create(null);
  const context = vm.createContext(sandbox, {
    codeGeneration: { strings: false, wasm: false },
    name: 'canonical-parser-v2',
  });
  const script = new vm.Script(runtimeProgram(modules, entryModule), {
    filename: 'canonical-parser-v2.runtime.js',
  });
  return { context, script };
}

function runInRestrictedContext({
  manifest,
  repositoryRoot = REPOSITORY_ROOT,
  sourceText,
  limits,
}) {
  if (typeof sourceText !== 'string') throw new TypeError('parser source text must be a string');
  if (Buffer.byteLength(sourceText, 'utf8') > limits.max_source_bytes) {
    throw new RangeError('parser source text exceeds its governed limit');
  }
  const modules = resolveRuntimeModules(manifest, repositoryRoot);
  const { context, script } = createRestrictedContext(modules, manifest.entry_module);
  const timeout = limits.max_runtime_milliseconds;
  script.runInContext(context, { timeout });
  const probeScript = new vm.Script('__capabilityProbe = __parserApi.capabilityProbe();');
  probeScript.runInContext(context, { timeout });
  const capabilityProbe = structuredClone(context.__capabilityProbe);
  if (Object.values(capabilityProbe).some((value) => value !== 'undefined'
    && value !== 'UNAVAILABLE')) {
    throw new Error('parser runtime exposes a forbidden ambient capability');
  }
  context.__rawText = sourceText;
  context.__limitsJson = JSON.stringify(limits);
  const runScript = new vm.Script(
    '__parserOutput = __parserApi.run(__rawText, JSON.parse(__limitsJson));',
  );
  runScript.runInContext(context, { timeout });
  const output = structuredClone(context.__parserOutput);
  delete context.__rawText;
  delete context.__limitsJson;
  delete context.__parserOutput;
  if (output.detector_error === 'GOVERNED_LIMIT_EXCEEDED') {
    throw new RangeError('parser runtime exceeded a governed collection limit');
  }
  return {
    ...output,
    capability_probe: capabilityProbe,
  };
}

module.exports = {
  resolveRuntimeModules,
  runInRestrictedContext,
};
