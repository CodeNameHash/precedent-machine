#!/usr/bin/env node
/**
 * Step 2X-J vocabulary inventory.
 *
 * Enumerates every vocabulary export in lib/taxonomy.js, the three external
 * V1 assets already consumed into Canonical V2, MAE_CARVEOUT_META's status,
 * and lib/schema/features.js display groups. Classifies each by whether
 * Canonical V2 resolver/corroboration actually require()s it (not mere
 * string-name collisions), versus V1-only surfaces.
 *
 * Usage:
 *   node scripts/audit/step-2x-j-vocab-inventory.js
 *   node scripts/audit/step-2x-j-vocab-inventory.js --write
 *
 * Default write path: docs/codex-program/notes/step-2x-j-vocab-inventory.json
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const DEFAULT_OUT = 'docs/codex-program/notes/step-2x-j-vocab-inventory.json';
const EXCLUDE_DIRS = new Set(['.git', '.next', 'node_modules', 'coverage', 'archive']);
const CODE_EXTS = new Set(['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx']);

const ALREADY_CONSUMED_EXTERNAL = [
  {
    name: 'party-role-aliases.js',
    path: 'lib/vocab/party-role-aliases.js',
    symbols: ['PARTY_ROLE_ALIASES', 'party-role-aliases'],
  },
  {
    name: 'ioc-categories.js',
    path: 'lib/vocab/ioc-categories.js',
    symbols: ['ioc-categories', 'HEADING_TO_IOC_CATEGORY', 'IOC_CATEGORY_BY_KEY'],
  },
  {
    name: 'ioc-components.js',
    path: 'lib/vocab/ioc-components.js',
    symbols: ['ioc-components', 'IOC_COMPONENTS_BY_CATEGORY'],
  },
];

function parseArgs(argv = process.argv.slice(2)) {
  const args = { write: false, out: DEFAULT_OUT };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--write') args.write = true;
    else if (argv[i] === '--out') args.out = argv[++i];
    else if (argv[i] === '--help') {
      console.log('Usage: node scripts/audit/step-2x-j-vocab-inventory.js [--write] [--out path]');
      process.exit(0);
    } else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return args;
}

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) {
      if (EXCLUDE_DIRS.has(ent.name)) continue;
      walk(path.join(dir, ent.name), files);
      continue;
    }
    if (!ent.isFile()) continue;
    if (!CODE_EXTS.has(path.extname(ent.name))) continue;
    files.push(path.join(dir, ent.name));
  }
  return files;
}

function layerOf(rel) {
  if (rel === 'lib/taxonomy.js') return null;
  if (
    rel.startsWith('lib/canonical-v2/native-producer/')
    && /candidate-resolution|corroboration|qualifier-kind-lexicon/.test(rel)
  ) {
    return 'V2_RESOLVER';
  }
  if (rel.startsWith('lib/canonical-v2/')) return 'V2_OTHER';
  if (rel.startsWith('lib/vocab/')) return 'V2_VOCAB';
  if (rel.startsWith('tests/')) return 'TEST';
  if (rel.startsWith('scripts/')) return 'SCRIPT';
  return 'V1_OR_OTHER';
}

function codeCount(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.keys(value).length;
  }
  if (Array.isArray(value)) return value.length;
  return 1;
}

function collectTaxonomyRequires(files) {
  /** @type {Map<string, {file: string, via: string}[]>} */
  const consumers = new Map();
  const add = (symbol, file, via) => {
    if (!symbol) return;
    const list = consumers.get(symbol) || [];
    list.push({ file, via });
    consumers.set(symbol, list);
  };

  // Match only the require(...taxonomy...) call, then walk left for the
  // matching destructure brace pair. A single /\{[\s\S]*?\}=require(taxonomy)/
  // regex falsely spans earlier require()s on adjacent lines.
  const requireRe = /require\((['"`])([^'"`]*taxonomy[^'"`]*)\1\)/g;

  for (const full of files) {
    const rel = path.relative(ROOT, full).replace(/\\/g, '/');
    if (rel === 'lib/taxonomy.js') continue;
    const text = fs.readFileSync(full, 'utf8');
    if (!/taxonomy/.test(text)) continue;

    for (const m of text.matchAll(requireRe)) {
      const requireIndex = m.index;
      const before = text.slice(0, requireIndex);
      const eq = before.lastIndexOf('=');
      if (eq < 0) continue;
      const between = before.slice(eq + 1);
      if (/\S/.test(between)) continue; // not `} = require(...)`
      // Walk left from '=' to find the matching '{' of a destructure.
      let i = eq - 1;
      while (i >= 0 && /\s/.test(before[i])) i -= 1;
      if (i < 0 || before[i] !== '}') continue;
      let depth = 0;
      let start = -1;
      for (let j = i; j >= 0; j -= 1) {
        const ch = before[j];
        if (ch === '}') depth += 1;
        else if (ch === '{') {
          depth -= 1;
          if (depth === 0) {
            start = j;
            break;
          }
        }
      }
      if (start < 0) continue;
      const head = before.slice(Math.max(0, start - 12), start);
      if (!/\b(?:const|let|var)\s*$/.test(head) && !/\b(?:const|let|var)\s*$/.test(before.slice(0, start))) {
        // Accept when the nearest preceding const/let/var is immediately before '{'
        const headSlice = before.slice(0, start);
        if (!/(?:const|let|var)\s*$/.test(headSlice.replace(/\s+$/, ''))) {
          // Still accept brace-destructure assigned from taxonomy require.
        }
      }
      const body = before.slice(start + 1, i);
      const names = body
        .split(',')
        .map((s) => s.trim().split(/\s+as\s+|\s*=\s*/)[0].trim())
        .filter((s) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(s));
      for (const n of names) add(n, rel, 'destructure');
    }

    // Namespace requires: const taxonomy = require('...taxonomy'); taxonomy.FOO
    // or const { FOO } = taxonomy;
    if (/require\((['"`])([^'"`]*taxonomy[^'"`]*)\1\)/.test(text)) {
      if (/(?:taxonomy|tax)\.[A-Z_]/.test(text)) {
        const propHits = text.matchAll(/(?:taxonomy|tax)\.([A-Z][A-Z0-9_]*)\b/g);
        for (const prop of propHits) add(prop[1], rel, 'property');
      }
      const fromNs = text.matchAll(
        /\{([^}]+)\}\s*=\s*(?:taxonomy|tax)\b/g,
      );
      for (const m of fromNs) {
        const names = m[1]
          .split(',')
          .map((s) => s.trim().split(/\s+as\s+|\s*=\s*/)[0].trim())
          .filter((s) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(s));
        for (const n of names) add(n, rel, 'ns_destructure');
      }
    }
  }
  return consumers;
}

function symbolMentions(files, symbol) {
  const re = new RegExp(`\\b${symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
  const byLayer = {};
  const filesByLayer = {};
  for (const full of files) {
    const rel = path.relative(ROOT, full).replace(/\\/g, '/');
    const layer = layerOf(rel);
    if (!layer) continue;
    const text = fs.readFileSync(full, 'utf8');
    if (!re.test(text)) continue;
    byLayer[layer] = (byLayer[layer] || 0) + 1;
    (filesByLayer[layer] || (filesByLayer[layer] = [])).push(rel);
  }
  return { byLayer, filesByLayer };
}

function main() {
  const args = parseArgs();
  const tax = require(path.join(ROOT, 'lib/taxonomy.js'));
  const files = walk(ROOT);
  const consumers = collectTaxonomyRequires(files);

  const helperNames = new Set([
    'normalizeToCode',
    'formatDict',
    'isValidTaxonomyCode',
    'labelForCode',
    'taxonomyForFeatureKey',
    'isListTaxonomyKey',
    'LIST_TAXONOMY_KEYS',
  ]);

  const rows = [];
  for (const name of Object.keys(tax).sort()) {
    const requireHits = consumers.get(name) || [];
    const mentions = symbolMentions(files, name);
    const requireFiles = [...new Set(requireHits.map((h) => h.file))];
    const requireLayers = {};
    for (const f of requireFiles) {
      const layer = layerOf(f);
      if (!layer) continue;
      requireLayers[layer] = (requireLayers[layer] || 0) + 1;
    }

    let consumption;
    if (helperNames.has(name)) {
      consumption = 'HELPER';
    } else if (requireLayers.V2_RESOLVER) {
      consumption = 'V2_RESOLVER_REQUIRE';
    } else if (requireLayers.V2_OTHER || requireLayers.V2_VOCAB) {
      consumption = 'V2_SURFACE_REQUIRE';
    } else if (requireFiles.length) {
      consumption = 'V1_REQUIRE';
    } else if (mentions.byLayer.V2_RESOLVER || mentions.byLayer.V2_OTHER) {
      consumption = 'NAME_COLLISION_ONLY';
    } else if (Object.keys(mentions.byLayer).length) {
      consumption = 'MENTION_NO_REQUIRE';
    } else {
      consumption = 'UNREFERENCED';
    }

    rows.push({
      name,
      kind: helperNames.has(name) ? 'helper' : 'vocabulary',
      code_count: helperNames.has(name) ? null : codeCount(tax[name]),
      is_meta: /_META$/.test(name),
      consumption,
      require_files: requireFiles,
      mention_layers: mentions.byLayer,
      v2_resolver_mention_files: mentions.filesByLayer.V2_RESOLVER || [],
    });
  }

  for (const ext of ALREADY_CONSUMED_EXTERNAL) {
    const merged = { byLayer: {}, filesByLayer: {} };
    for (const sym of ext.symbols) {
      const m = symbolMentions(files, sym);
      for (const [k, v] of Object.entries(m.byLayer)) {
        merged.byLayer[k] = (merged.byLayer[k] || 0) + v;
      }
      for (const [k, arr] of Object.entries(m.filesByLayer)) {
        merged.filesByLayer[k] = [...new Set([...(merged.filesByLayer[k] || []), ...arr])];
      }
    }
    rows.push({
      name: ext.name,
      kind: 'external_vocab',
      external_path: ext.path,
      code_count: null,
      consumption: merged.byLayer.V2_RESOLVER
        ? 'V2_RESOLVER_REQUIRE'
        : (merged.byLayer.V2_OTHER || merged.byLayer.V2_VOCAB)
          ? 'V2_SURFACE_REQUIRE'
          : 'UNREFERENCED',
      require_files: merged.filesByLayer.V2_RESOLVER || [],
      mention_layers: merged.byLayer,
    });
  }

  const { FEATURES } = require(path.join(ROOT, 'lib/schema/features.js'));
  const displayGroups = {};
  for (const [key, feature] of Object.entries(FEATURES)) {
    const group = feature.displayGroup || '(none)';
    if (!displayGroups[group]) displayGroups[group] = { count: 0, sample_keys: [] };
    displayGroups[group].count += 1;
    if (displayGroups[group].sample_keys.length < 6) {
      displayGroups[group].sample_keys.push(key);
    }
  }

  const { CATEGORY_SUMMARY_FEATURES } = require(
    path.join(ROOT, 'lib/category-summary-features.js'),
  );
  const perFamily = {};
  let categoryRowTotal = 0;
  for (const [family, familyRows] of Object.entries(CATEGORY_SUMMARY_FEATURES)) {
    perFamily[family] = familyRows.length;
    categoryRowTotal += familyRows.length;
  }

  const byConsumption = {};
  for (const row of rows) {
    byConsumption[row.consumption] = (byConsumption[row.consumption] || 0) + 1;
  }

  const out = {
    generated_at: new Date().toISOString(),
    method:
      'require()-destructure/property from *taxonomy* modules; mention layers are secondary. '
      + 'V2_RESOLVER = candidate-resolution | *corroboration* | qualifier-kind-lexicon.',
    by_consumption: byConsumption,
    vocabulary_export_count: rows.filter((r) => r.kind === 'vocabulary').length,
    helper_count: rows.filter((r) => r.kind === 'helper').length,
    external_count: rows.filter((r) => r.kind === 'external_vocab').length,
    rows,
    features: {
      definition_count: Object.keys(FEATURES).length,
      display_groups: displayGroups,
    },
    category_summary: {
      family_count: Object.keys(perFamily).length,
      row_total: categoryRowTotal,
      per_family: perFamily,
      note:
        'Per-family expected-yield targets for Step 2X-J measurement (PLAN.md). '
        + 'Not itself a codebook vocabulary to consume into corroboration.',
    },
    already_consumed_named_in_plan: [
      'party-role-aliases.js',
      'TERMF_TRIGGER_META',
      'ioc-categories.js',
      'ioc-components.js',
      'MATERIALITY_CODES',
    ],
  };

  const json = `${JSON.stringify(out, null, 2)}\n`;
  if (args.write) {
    const outPath = path.join(ROOT, args.out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, json);
    console.log(`Wrote ${args.out}`);
  }
  console.log(JSON.stringify(byConsumption, null, 2));
  console.log(
    `vocabularies=${out.vocabulary_export_count} helpers=${out.helper_count} `
      + `external=${out.external_count} features=${out.features.definition_count} `
      + `category_summary_rows=${categoryRowTotal}`,
  );
}

main();
