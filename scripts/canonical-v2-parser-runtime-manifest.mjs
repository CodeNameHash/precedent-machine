#!/usr/bin/env node

import {
  builtinModules,
  createRequire,
} from 'node:module';
import {
  existsSync,
  lstatSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import {
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const require = createRequire(import.meta.url);
const { canonicalJson, contentId } = require('../lib/canonical-v2/canonical-bytes');

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPOSITORY_ROOT = resolve(dirname(SCRIPT_PATH), '..');

export const ENTRY_MODULE = 'lib/parser-v2/canonical-structural-definitions.js';
export const MANIFEST_PATH =
  'lib/parser-v2/canonical-structural-definitions.manifest.json';
export const SCHEMA_VERSION = 'PARSER_V2_RUNTIME_MANIFEST/V1';
export const GOVERNED_LIMITS = Object.freeze({
  max_source_bytes: 4194304,
  max_sections: 4096,
  max_definitions: 16384,
  max_residuals: 4096,
  max_total_candidates: 16384,
  max_span_bytes: 2097152,
  max_envelope_bytes: 16777216,
  max_runtime_milliseconds: 5000,
});

const SOURCE_EXTENSIONS = new Set(['.js', '.cjs', '.mjs']);
const RESOLUTION_SUFFIXES = Object.freeze([
  '',
  '.js',
  '.cjs',
  '.mjs',
  '.json',
  '/index.js',
  '/index.cjs',
  '/index.mjs',
  '/index.json',
]);
const BUILTIN_MODULES = new Set(
  builtinModules.flatMap((name) => [name, `node:${name}`]),
);

export const FORBIDDEN_MODULE_PATTERNS = Object.freeze([
  /^(?:pages|scripts|supabase)\//,
  /(?:^|\/)(?:anthropic|model|llm(?:-cli-client)?|openai)\.(?:js|cjs|mjs)$/,
  /(?:^|\/)(?:store|store-[^/]*|region-store|run-extract|reapply-corrections)\.(?:js|cjs|mjs)$/,
  /(?:^|\/)(?:extract|classify)\.(?:js|cjs|mjs)$/,
  /(?:^|\/)[^/]*writer[^/]*\.(?:js|cjs|mjs)$/,
  /(?:^|\/)(?:canonical-write-envelope|validate-write-set)\.(?:js|cjs|mjs)$/,
  /(?:^|\/)(?:ingest|ingest-[^/]*)\.(?:js|cjs|mjs)$/,
]);

export const FORBIDDEN_SOURCE_PATTERNS = Object.freeze([
  Object.freeze({
    label: 'database mutation',
    pattern: /\.\s*(?:insert|upsert|update|delete)\s*\(/,
  }),
  Object.freeze({
    label: 'database client construction',
    pattern: /\b(?:createClient|SupabaseClient)\s*\(/,
  }),
  Object.freeze({
    label: 'model invocation',
    pattern: /\bmessages\s*\.\s*create\s*\(|\bresponses\s*\.\s*create\s*\(/,
  }),
  Object.freeze({
    label: 'network invocation',
    pattern: /\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\s*\(/,
  }),
  Object.freeze({
    label: 'canonical writer authority',
    pattern: /\bcanonical_v2_write\b|\bcanonicalWriter\b|\bwriteCanonical/i,
  }),
  Object.freeze({
    label: 'filesystem mutation',
    pattern: /\b(?:appendFile|copyFile|createWriteStream|mkdir|rename|rm|rmdir|truncate|unlink|writeFile)(?:Sync)?\s*\(/,
  }),
  Object.freeze({
    label: 'environment credential access',
    pattern: /\bprocess\s*\.\s*env\b/,
  }),
  Object.freeze({
    label: 'runtime code generation',
    pattern: /\beval\s*\(|\bnew\s+Function\s*\(/,
  }),
  Object.freeze({
    label: 'nondeterministic clock',
    pattern: /\bDate\s*\.\s*now\s*\(|\bnew\s+Date\s*\(/,
  }),
  Object.freeze({
    label: 'nondeterministic randomness',
    pattern: /\bMath\s*\.\s*random\s*\(|\brandomUUID\s*\(|\brandomBytes\s*\(/,
  }),
]);

function slashPath(value) {
  return value.split(sep).join('/');
}

function sha256Hex(value) {
  return createHash('sha256').update(value).digest('hex');
}

function isIdentifierStart(character) {
  return /[A-Za-z_$]/.test(character || '');
}

function isIdentifierPart(character) {
  return /[A-Za-z0-9_$]/.test(character || '');
}

function skipWhitespaceAndComments(source, start) {
  let index = start;
  for (;;) {
    while (index < source.length && /\s/.test(source[index])) index += 1;
    if (source.startsWith('//', index)) {
      const newline = source.indexOf('\n', index + 2);
      index = newline < 0 ? source.length : newline + 1;
      continue;
    }
    if (source.startsWith('/*', index)) {
      const close = source.indexOf('*/', index + 2);
      if (close < 0) throw new Error('unterminated block comment');
      index = close + 2;
      continue;
    }
    return index;
  }
}

function readStringLiteral(source, start) {
  const quote = source[start];
  if (quote !== "'" && quote !== '"') return null;
  let value = '';
  for (let index = start + 1; index < source.length; index += 1) {
    const character = source[index];
    if (character === '\\') {
      throw new Error('escaped module specifiers are not permitted');
    }
    if (character === quote) {
      return { value, end: index + 1 };
    }
    if (character === '\n' || character === '\r') {
      throw new Error('unterminated module specifier');
    }
    value += character;
  }
  throw new Error('unterminated string literal');
}

function skipStringLiteral(source, start) {
  const quote = source[start];
  let index = start + 1;
  while (index < source.length) {
    if (source[index] === '\\') {
      index += 2;
      continue;
    }
    if (source[index] === quote) return index + 1;
    index += 1;
  }
  throw new Error('unterminated string literal');
}

function regexCanStartAt(source, start) {
  let index = start - 1;
  while (index >= 0 && /\s/.test(source[index])) index -= 1;
  if (index < 0) return true;
  if (/[\(\[\{,:;=!?&|+\-*%^~<>]/.test(source[index])) return true;
  if (!isIdentifierPart(source[index])) return false;
  const end = index + 1;
  while (index >= 0 && isIdentifierPart(source[index])) index -= 1;
  return /^(?:await|case|delete|in|instanceof|of|return|throw|typeof|void|yield)$/
    .test(source.slice(index + 1, end));
}

function skipRegexLiteral(source, start) {
  if (source[start] !== '/' || !regexCanStartAt(source, start)) return null;
  let inCharacterClass = false;
  for (let index = start + 1; index < source.length; index += 1) {
    const character = source[index];
    if (character === '\\') {
      index += 1;
      continue;
    }
    if (character === '\n' || character === '\r') return null;
    if (character === '[') {
      inCharacterClass = true;
      continue;
    }
    if (character === ']' && inCharacterClass) {
      inCharacterClass = false;
      continue;
    }
    if (character === '/' && !inCharacterClass) {
      let end = index + 1;
      while (/[A-Za-z]/.test(source[end] || '')) end += 1;
      return end;
    }
  }
  return null;
}

function skipTemplateLiteral(source, start, modulePath) {
  let index = start + 1;
  while (index < source.length) {
    if (source[index] === '\\') {
      index += 2;
      continue;
    }
    if (source[index] === '`') return index + 1;
    if (source[index] === '$' && source[index + 1] === '{') {
      const tail = source.slice(index + 2);
      if (/\b(?:require|import)\s*\(/.test(tail)) {
        throw new Error(`${modulePath} contains module loading inside a template expression`);
      }
    }
    index += 1;
  }
  throw new Error(`${modulePath} contains an unterminated template literal`);
}

function readStaticImport(source, start, modulePath) {
  let index = skipWhitespaceAndComments(source, start);
  const direct = readStringLiteral(source, index);
  if (direct) return direct;

  let braceDepth = 0;
  while (index < source.length) {
    index = skipWhitespaceAndComments(source, index);
    const character = source[index];
    if (character === ';') break;
    if (character === '\n' && braceDepth === 0) {
      const remainder = source.slice(index);
      if (!/^\s*(?:from\b|['"])/.test(remainder)) break;
    }
    if (character === "'" || character === '"') {
      index = skipStringLiteral(source, index);
      continue;
    }
    if (character === '{' || character === '[' || character === '(') {
      braceDepth += 1;
      index += 1;
      continue;
    }
    if (character === '}' || character === ']' || character === ')') {
      braceDepth = Math.max(0, braceDepth - 1);
      index += 1;
      continue;
    }
    if (isIdentifierStart(character)) {
      const identifierStart = index;
      index += 1;
      while (isIdentifierPart(source[index])) index += 1;
      const identifier = source.slice(identifierStart, index);
      if (identifier === 'from') {
        index = skipWhitespaceAndComments(source, index);
        const specifier = readStringLiteral(source, index);
        if (!specifier) {
          throw new Error(`${modulePath} contains an invalid static import`);
        }
        return specifier;
      }
      continue;
    }
    index += 1;
  }
  throw new Error(`${modulePath} contains an unresolved static import`);
}

function readExportFrom(source, start, modulePath) {
  let index = skipWhitespaceAndComments(source, start);
  let braceDepth = 0;
  while (index < source.length) {
    index = skipWhitespaceAndComments(source, index);
    const character = source[index];
    if (character === ';') return null;
    if (character === '\n' && braceDepth === 0) return null;
    if (character === "'" || character === '"') {
      index = skipStringLiteral(source, index);
      continue;
    }
    if (character === '{' || character === '[' || character === '(') {
      braceDepth += 1;
      index += 1;
      continue;
    }
    if (character === '}' || character === ']' || character === ')') {
      braceDepth = Math.max(0, braceDepth - 1);
      index += 1;
      continue;
    }
    if (isIdentifierStart(character)) {
      const identifierStart = index;
      index += 1;
      while (isIdentifierPart(source[index])) index += 1;
      if (source.slice(identifierStart, index) === 'from') {
        index = skipWhitespaceAndComments(source, index);
        const specifier = readStringLiteral(source, index);
        if (!specifier) {
          throw new Error(`${modulePath} contains an invalid export-from edge`);
        }
        return specifier;
      }
      continue;
    }
    index += 1;
  }
  return null;
}

export function literalModuleSpecifiers(source, modulePath = '<module>') {
  const specifiers = [];
  let index = 0;

  while (index < source.length) {
    index = skipWhitespaceAndComments(source, index);
    if (index >= source.length) break;
    const character = source[index];
    if (character === "'" || character === '"') {
      index = skipStringLiteral(source, index);
      continue;
    }
    if (character === '`') {
      index = skipTemplateLiteral(source, index, modulePath);
      continue;
    }
    if (character === '/') {
      const regexEnd = skipRegexLiteral(source, index);
      if (regexEnd !== null) {
        index = regexEnd;
        continue;
      }
    }
    if (!isIdentifierStart(character)) {
      index += 1;
      continue;
    }

    const identifierStart = index;
    index += 1;
    while (isIdentifierPart(source[index])) index += 1;
    const identifier = source.slice(identifierStart, index);

    if (identifier === 'require') {
      let cursor = skipWhitespaceAndComments(source, index);
      if (source[cursor] !== '(') {
        throw new Error(`${modulePath} contains non-call require authority`);
      }
      cursor = skipWhitespaceAndComments(source, cursor + 1);
      const specifier = readStringLiteral(source, cursor);
      if (!specifier) {
        throw new Error(`${modulePath} contains dynamic require`);
      }
      cursor = skipWhitespaceAndComments(source, specifier.end);
      if (source[cursor] !== ')') {
        throw new Error(`${modulePath} contains non-literal require arguments`);
      }
      specifiers.push(specifier.value);
      index = cursor + 1;
      continue;
    }

    if (identifier === 'import') {
      const cursor = skipWhitespaceAndComments(source, index);
      if (source[cursor] === '(') {
        throw new Error(`${modulePath} contains dynamic import`);
      }
      if (source[cursor] === '.') {
        index = cursor + 1;
        continue;
      }
      const specifier = readStaticImport(source, index, modulePath);
      specifiers.push(specifier.value);
      index = specifier.end;
      continue;
    }

    if (identifier === 'export') {
      const specifier = readExportFrom(source, index, modulePath);
      if (specifier) {
        specifiers.push(specifier.value);
        index = specifier.end;
      }
    }
  }

  return specifiers;
}

function maskCommentsAndStrings(source) {
  const output = [...source];
  let index = 0;
  while (index < source.length) {
    if (source.startsWith('//', index)) {
      const end = source.indexOf('\n', index + 2);
      const stop = end < 0 ? source.length : end;
      for (let cursor = index; cursor < stop; cursor += 1) output[cursor] = ' ';
      index = stop;
      continue;
    }
    if (source.startsWith('/*', index)) {
      const end = source.indexOf('*/', index + 2);
      if (end < 0) throw new Error('unterminated block comment');
      for (let cursor = index; cursor < end + 2; cursor += 1) output[cursor] = ' ';
      index = end + 2;
      continue;
    }
    if (source[index] === "'" || source[index] === '"' || source[index] === '`') {
      const quote = source[index];
      let cursor = index + 1;
      while (cursor < source.length) {
        if (source[cursor] === '\\') {
          cursor += 2;
          continue;
        }
        if (source[cursor] === quote) {
          cursor += 1;
          break;
        }
        cursor += 1;
      }
      for (let mask = index; mask < cursor; mask += 1) output[mask] = ' ';
      index = cursor;
      continue;
    }
    if (source[index] === '/') {
      const regexEnd = skipRegexLiteral(source, index);
      if (regexEnd !== null) {
        for (let mask = index; mask < regexEnd; mask += 1) output[mask] = ' ';
        index = regexEnd;
        continue;
      }
    }
    index += 1;
  }
  return output.join('');
}

export function assertSourceHasNoForbiddenAuthority(source, modulePath) {
  const code = maskCommentsAndStrings(source);
  for (const { label, pattern } of FORBIDDEN_SOURCE_PATTERNS) {
    if (pattern.test(code)) {
      throw new Error(`${modulePath} contains forbidden ${label}`);
    }
  }
}

export function assertModulePathAllowed(modulePath) {
  if (FORBIDDEN_MODULE_PATTERNS.some((pattern) => pattern.test(modulePath))) {
    throw new Error(`${modulePath} is forbidden from the parser runtime`);
  }
}

function resolveLocalModule(repositoryRoot, fromModule, specifier) {
  if (BUILTIN_MODULES.has(specifier) || specifier.startsWith('node:')) {
    throw new Error(`${fromModule} imports forbidden node builtin ${specifier}`);
  }
  if (!specifier.startsWith('./') && !specifier.startsWith('../')) {
    throw new Error(`${fromModule} imports forbidden external package ${specifier}`);
  }
  if (isAbsolute(specifier)) {
    throw new Error(`${fromModule} imports an absolute module path`);
  }

  const fromAbsolute = resolve(repositoryRoot, fromModule);
  const unresolved = resolve(dirname(fromAbsolute), specifier);
  let resolvedPath = null;
  for (const suffix of RESOLUTION_SUFFIXES) {
    const candidate = `${unresolved}${suffix}`;
    if (existsSync(candidate) && lstatSync(candidate).isFile()) {
      resolvedPath = realpathSync(candidate);
      break;
    }
  }
  if (!resolvedPath) {
    throw new Error(`${fromModule} imports unresolved local module ${specifier}`);
  }

  const rootRealPath = realpathSync(repositoryRoot);
  const relativePath = relative(rootRealPath, resolvedPath);
  if (!relativePath || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) {
    throw new Error(`${fromModule} imports outside the repository: ${specifier}`);
  }
  const modulePath = slashPath(relativePath);
  assertModulePathAllowed(modulePath);
  return modulePath;
}

export function buildParserRuntimeManifest({
  repositoryRoot = REPOSITORY_ROOT,
  entryModule = ENTRY_MODULE,
} = {}) {
  const root = realpathSync(repositoryRoot);
  const normalisedEntry = slashPath(entryModule);
  assertModulePathAllowed(normalisedEntry);
  const entryAbsolute = resolve(root, normalisedEntry);
  if (!existsSync(entryAbsolute) || !lstatSync(entryAbsolute).isFile()) {
    throw new Error(`parser runtime entry module is missing: ${normalisedEntry}`);
  }

  const pending = [normalisedEntry];
  const visited = new Set();
  const localModules = [];

  while (pending.length > 0) {
    pending.sort();
    const modulePath = pending.shift();
    if (visited.has(modulePath)) continue;
    visited.add(modulePath);
    assertModulePathAllowed(modulePath);

    const absolutePath = resolve(root, modulePath);
    const bytes = readFileSync(absolutePath);
    localModules.push({
      path: modulePath,
      sha256: sha256Hex(bytes),
    });

    if (!SOURCE_EXTENSIONS.has(extname(modulePath))) continue;
    const source = bytes.toString('utf8');
    if (!Buffer.from(source, 'utf8').equals(bytes)) {
      throw new Error(`${modulePath} is not valid UTF-8 source`);
    }
    assertSourceHasNoForbiddenAuthority(source, modulePath);
    for (const specifier of literalModuleSpecifiers(source, modulePath)) {
      const dependency = resolveLocalModule(root, modulePath, specifier);
      if (!visited.has(dependency)) pending.push(dependency);
    }
  }

  localModules.sort((left, right) => (
    left.path < right.path ? -1 : left.path > right.path ? 1 : 0
  ));
  const body = {
    schema_version: SCHEMA_VERSION,
    entry_module: normalisedEntry,
    local_modules: localModules,
    governed_limits: { ...GOVERNED_LIMITS },
  };
  return {
    ...body,
    parser_runtime_manifest_id: contentId(SCHEMA_VERSION, body),
  };
}

export function serialiseParserRuntimeManifest(manifest) {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export function checkParserRuntimeManifest({
  repositoryRoot = REPOSITORY_ROOT,
  entryModule = ENTRY_MODULE,
  manifestPath = MANIFEST_PATH,
} = {}) {
  const expected = buildParserRuntimeManifest({ repositoryRoot, entryModule });
  const absoluteManifestPath = resolve(repositoryRoot, manifestPath);
  if (!existsSync(absoluteManifestPath)) {
    throw new Error(`parser runtime manifest is missing: ${manifestPath}`);
  }
  const actualText = readFileSync(absoluteManifestPath, 'utf8');
  const expectedText = serialiseParserRuntimeManifest(expected);
  if (actualText !== expectedText) {
    let actual;
    try {
      actual = JSON.parse(actualText);
    } catch {
      throw new Error('parser runtime manifest is not valid deterministic JSON');
    }
    if (canonicalJson(actual) !== canonicalJson(expected)) {
      throw new Error('parser runtime manifest does not match the exact dependency closure');
    }
    throw new Error('parser runtime manifest serialization is not deterministic');
  }
  return expected;
}

function usage() {
  return 'Usage: node scripts/canonical-v2-parser-runtime-manifest.mjs --write|--check';
}

function main() {
  const mode = process.argv[2];
  if ((mode !== '--write' && mode !== '--check') || process.argv.length !== 3) {
    throw new Error(usage());
  }
  if (mode === '--write') {
    const manifest = buildParserRuntimeManifest();
    writeFileSync(
      resolve(REPOSITORY_ROOT, MANIFEST_PATH),
      serialiseParserRuntimeManifest(manifest),
      'utf8',
    );
    process.stdout.write(
      `Wrote parser runtime manifest with ${manifest.local_modules.length} modules.\n`,
    );
    return;
  }
  const manifest = checkParserRuntimeManifest();
  process.stdout.write(
    `Verified parser runtime manifest with ${manifest.local_modules.length} modules.\n`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === SCRIPT_PATH) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
