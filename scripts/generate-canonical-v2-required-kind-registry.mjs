#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(
  SCRIPT_DIRECTORY,
  '../contracts/canonical-v2/successor',
);
const REGISTRY_RELATIVE_PATH =
  'governance/canonical-bundle-input-required-kind-registry.v1.json';
const REGISTRY_OBJECT_KIND = 'CANONICAL_BUNDLE_INPUT_REQUIRED_KIND_REGISTRY';
const REGISTRY_STABLE_ID = 'CANONICAL_BUNDLE_INPUT_REQUIRED_KIND_REGISTRY';
const REGISTRY_SCHEMA_VERSION =
  'CANONICAL_BUNDLE_INPUT_REQUIRED_KIND_REGISTRY/V1';

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function parseArguments(argv) {
  const result = {
    root: DEFAULT_ROOT,
    check: false,
    stdout: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--check') {
      result.check = true;
    } else if (value === '--stdout') {
      result.stdout = true;
    } else if (value === '--root') {
      index += 1;
      if (!argv[index]) throw new Error('--root requires a path');
      result.root = path.resolve(argv[index]);
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }
  if (result.check && result.stdout) {
    throw new Error('--check and --stdout cannot be combined');
  }
  return result;
}

function enumerateJsonFiles(root) {
  const files = [];

  function walk(directory, relativeDirectory) {
    const entries = fs.readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => compareText(left.name, right.name));
    for (const entry of entries) {
      const relativePath = relativeDirectory
        ? `${relativeDirectory}/${entry.name}`
        : entry.name;
      const absolutePath = path.join(directory, entry.name);
      const stat = fs.lstatSync(absolutePath);
      if (stat.isSymbolicLink()) {
        throw new Error(`Symbolic links are not permitted: ${relativePath}`);
      }
      if (stat.isDirectory()) {
        walk(absolutePath, relativePath);
      } else if (stat.isFile() && relativePath.endsWith('.json')) {
        if (path.posix.basename(relativePath) === 'manifest.json') continue;
        if (relativePath === REGISTRY_RELATIVE_PATH) continue;
        files.push(relativePath);
      }
    }
  }

  walk(root, '');
  return files.sort(compareText);
}

function memberMetadata(root, relativePath) {
  const value = JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
  for (const key of ['object_kind', 'stable_id', 'schema_version']) {
    if (typeof value[key] !== 'string' || value[key].length === 0) {
      throw new Error(`${relativePath} has no valid ${key}`);
    }
  }
  if (value.object_kind === REGISTRY_OBJECT_KIND) {
    throw new Error(
      `A required-kind registry exists outside ${REGISTRY_RELATIVE_PATH}: ${relativePath}`,
    );
  }
  return {
    object_kind: value.object_kind,
    schema_version: value.schema_version,
  };
}

function buildRegistry(root) {
  const byKind = new Map();
  for (const relativePath of enumerateJsonFiles(root)) {
    const member = memberMetadata(root, relativePath);
    if (!byKind.has(member.object_kind)) {
      byKind.set(member.object_kind, {
        count: 0,
        schemaVersions: new Set(),
      });
    }
    const state = byKind.get(member.object_kind);
    state.count += 1;
    state.schemaVersions.add(member.schema_version);
  }
  if (byKind.size === 0) throw new Error('The successor contract tree is empty');
  byKind.set(REGISTRY_OBJECT_KIND, {
    count: 1,
    schemaVersions: new Set([REGISTRY_SCHEMA_VERSION]),
  });

  return {
    object_kind: REGISTRY_OBJECT_KIND,
    stable_id: REGISTRY_STABLE_ID,
    schema_version: REGISTRY_SCHEMA_VERSION,
    required_kinds: [...byKind.entries()]
      .sort(([left], [right]) => compareText(left, right))
      .map(([objectKind, state]) => ({
        object_kind: objectKind,
        minimum_count: state.count,
        maximum_count: state.count,
        allowed_schema_versions: [...state.schemaVersions].sort(compareText),
      })),
  };
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const registryBytes = `${JSON.stringify(buildRegistry(options.root), null, 2)}\n`;
  const registryPath = path.join(
    options.root,
    ...REGISTRY_RELATIVE_PATH.split('/'),
  );

  if (options.check) {
    if (!fs.existsSync(registryPath)
      || fs.readFileSync(registryPath, 'utf8') !== registryBytes) {
      process.stderr.write('Required-kind registry is stale.\n');
      process.exitCode = 1;
    }
    return;
  }
  if (options.stdout) {
    process.stdout.write(registryBytes);
    return;
  }
  fs.mkdirSync(path.dirname(registryPath), { recursive: true });
  fs.writeFileSync(registryPath, registryBytes);
}

main();
