#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { canonicalJson } = require('../lib/canonical-v2/canonical-bytes');

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(
  SCRIPT_DIRECTORY,
  '../contracts/canonical-v2/successor',
);

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
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
  return result;
}

function enumerateJsonFiles(root) {
  const members = [];

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
        if (relativePath === 'manifest.json') continue;
        if (path.posix.basename(relativePath) === 'manifest.json') {
          throw new Error(`Nested manifests are not permitted: ${relativePath}`);
        }
        members.push(relativePath);
      }
    }
  }

  walk(root, '');
  return members.sort(compareText);
}

function parseMember(root, relativePath) {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
  const value = JSON.parse(source);
  for (const key of ['object_kind', 'stable_id', 'schema_version']) {
    if (typeof value[key] !== 'string' || value[key].length === 0) {
      throw new Error(`${relativePath} has no valid ${key}`);
    }
  }
  return {
    relative_path: relativePath,
    object_kind: value.object_kind,
    stable_id: value.stable_id,
    schema_version: value.schema_version,
    canonical_bytes_digest: sha256(Buffer.from(canonicalJson(value), 'utf8')),
  };
}

function buildManifest(root) {
  const members = enumerateJsonFiles(root).map((relativePath) => parseMember(root, relativePath));
  if (members.length === 0) throw new Error('The successor input tree is empty');

  const perKindCounts = {};
  const versionsByKind = new Map();
  for (const member of members) {
    perKindCounts[member.object_kind] = (perKindCounts[member.object_kind] || 0) + 1;
    if (!versionsByKind.has(member.object_kind)) {
      versionsByKind.set(member.object_kind, new Set());
    }
    versionsByKind.get(member.object_kind).add(member.schema_version);
  }

  const orderedCounts = {};
  const orderedVersions = {};
  for (const kind of Object.keys(perKindCounts).sort(compareText)) {
    orderedCounts[kind] = perKindCounts[kind];
    orderedVersions[kind] = [...versionsByKind.get(kind)].sort(compareText);
  }

  return {
    schema_version: 'CANONICAL_BUNDLE_INPUT_MANIFEST/V1',
    compiler_input_schema_version: 'CANONICAL_BUNDLE_INPUT_COMPILER/V1',
    generator_input_schema_version: 'CANONICAL_BUNDLE_GENERATOR_INPUT/V1',
    members,
    per_kind_counts: orderedCounts,
    per_kind_schema_versions: orderedVersions,
  };
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const manifest = `${JSON.stringify(buildManifest(options.root), null, 2)}\n`;
  const manifestPath = path.join(options.root, 'manifest.json');

  if (options.check) {
    const current = fs.readFileSync(manifestPath, 'utf8');
    if (current !== manifest) {
      process.stderr.write('Successor manifest is stale.\n');
      process.exitCode = 1;
      return;
    }
  }

  if (options.stdout) {
    process.stdout.write(manifest);
  } else if (!options.check) {
    fs.writeFileSync(manifestPath, manifest);
  }
}

main();
