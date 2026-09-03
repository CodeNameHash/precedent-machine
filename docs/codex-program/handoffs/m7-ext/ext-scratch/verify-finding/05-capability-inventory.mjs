'use strict';

/**
 * Inspect lib/ for components that produce typed facts or classifications
 * from agreement text. Counts come from loaded registries and file reads,
 * not from header comments.
 */

import { createRequire } from 'node:module';
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, extname, relative, resolve } from 'node:path';
import { repoRootFrom } from './repo-root.mjs';

const repoRoot = repoRootFrom(import.meta.url);
const require = createRequire(resolve(repoRoot, 'package.json'));
const OUT_DIR = dirname(new URL(import.meta.url).pathname);
const MAX_SCAN_BYTES = 2_000_000;

const WORK3_ANALYSIS_SET = resolve(
  repoRoot,
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work3-agreement-analysis-set.json',
);
const WORK3_INDEX_SET = resolve(
  repoRoot,
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work3-agreement-index-set.json',
);
const WORK3_CONTEXT_SET = resolve(
  repoRoot,
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work3-context-compilation-set.json',
);

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function rel(path) {
  return relative(repoRoot, path).split('\\').join('/');
}

function activeLines(source) {
  const lines = [];
  let block = false;
  for (const raw of source.split(/\r?\n/)) {
    const trimmed = raw.trim();
    if (block) {
      if (trimmed.includes('*/')) block = false;
      continue;
    }
    if (trimmed.startsWith('/*')) {
      if (!trimmed.includes('*/')) block = true;
      continue;
    }
    if (trimmed.startsWith('//')) continue;
    lines.push(raw);
  }
  return lines;
}

function requireSpecifiers(source) {
  const out = [];
  const re = /require\(\s*(['"])([^'"]+)\1\s*\)/g;
  let match;
  while ((match = re.exec(source))) out.push(match[2]);
  return out;
}

function resolveLibRequire(fromFile, specifier) {
  if (!specifier.startsWith('.')) return null;
  let abs = resolve(dirname(fromFile), specifier);
  if (!extname(abs)) {
    if (existsSync(`${abs}.js`)) abs = `${abs}.js`;
    else if (existsSync(`${abs}.mjs`)) abs = `${abs}.mjs`;
    else if (existsSync(resolve(abs, 'index.js'))) abs = resolve(abs, 'index.js');
    else return null;
  }
  const normalized = rel(abs);
  return normalized.startsWith('lib/') ? normalized : null;
}

function walkFiles(rootDir, predicate, into = [], depth = 0) {
  if (!existsSync(rootDir) || depth > 12) return into;
  let entries;
  try {
    entries = readdirSync(rootDir, { withFileTypes: true });
  } catch {
    return into;
  }
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const full = resolve(rootDir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      walkFiles(full, predicate, into, depth + 1);
    } else if (entry.isFile() && predicate(full, entry.name)) {
      into.push(full);
    }
  }
  return into;
}

function readIfSmall(path) {
  const size = statSync(path).size;
  if (size > MAX_SCAN_BYTES) return { source: null, size, skipped: true };
  return { source: readFileSync(path, 'utf8'), size, skipped: false };
}

function classifyReads(lines) {
  const text = lines.join('\n');
  const hasReadApi = /\b(?:readFileSync|readFile|createReadStream|openSync|promises\.readFile)\s*\(/.test(text)
    || /\brequire\(\s*['"][^'"]+\.json['"]\s*\)/.test(text);
  const evidenceLiterals = (text.match(/['"][^'"]*evidence\/[^'"]*['"]/g) || []).length;
  const fixtureLiterals = (text.match(/['"][^'"]*(?:fixture|\/tests\/)[^'"]*['"]/g) || []).length;
  const specs = requireSpecifiers(text);
  const evidenceViaRequire = specs.some((spec) => spec.includes('evidence/') && spec.endsWith('.json'));
  const fixtureViaRequire = specs.some((spec) => /fixture/i.test(spec));
  return {
    reads_evidence: hasReadApi && (evidenceLiterals > 0 || evidenceViaRequire),
    reads_fixtures: hasReadApi && (fixtureLiterals > 0 || fixtureViaRequire),
    evidence_literal_count: evidenceLiterals,
    fixture_literal_count: fixtureLiterals,
  };
}

function functionNames(mod) {
  if (!mod || typeof mod !== 'object') return [];
  return Object.entries(mod)
    .filter(([, value]) => typeof value === 'function')
    .map(([name]) => name)
    .sort();
}

function schemaConstants(mod) {
  if (!mod || typeof mod !== 'object') return [];
  const names = [];
  for (const [key, value] of Object.entries(mod)) {
    if (typeof value === 'string' && /SCHEMA|schema_version/i.test(key)) names.push(`${key}=${value}`);
  }
  return names;
}

const SCHEMA_FILE_CACHE = [];
function schemaFileIndex() {
  if (SCHEMA_FILE_CACHE.length > 0) return SCHEMA_FILE_CACHE;
  for (const root of [resolve(repoRoot, 'lib'), resolve(repoRoot, 'docs/review-queue')]) {
    walkFiles(root, (_full, name) => {
      const base = name.toLowerCase();
      return base.includes('schema') && (base.endsWith('.js') || base.endsWith('.json'));
    }, SCHEMA_FILE_CACHE);
  }
  return SCHEMA_FILE_CACHE;
}

function findSchemaFiles(tokens) {
  const lowered = tokens.map((token) => token.toLowerCase().replace(/[/]/g, '-'));
  return [...new Set(schemaFileIndex().filter((full) => {
    const base = full.toLowerCase();
    if (base.includes('validator') || base.includes('test') || base.includes('audit')) return false;
    return lowered.some((token) => base.includes(token));
  }).map(rel))].sort();
}

function parseRegistryPromptPaths(registrySource) {
  const map = new Map();
  const requireRe = /require\('\.\/([^']+)'\)/g;
  const requires = [];
  let match;
  while ((match = requireRe.exec(registrySource))) {
    requires.push(`lib/canonical-v2/native-producer/${match[1]}.js`);
  }
  const entryRe = /\['([A-Z0-9_]+)',\s*([A-Za-z0-9_]+)\]/g;
  const builders = new Map();
  while ((match = entryRe.exec(registrySource))) {
    builders.set(match[2], match[1]);
  }
  const builderFromPath = new Map();
  const builderDecl = /const \{\s*([A-Za-z0-9_]+)\s*\} = require\('\.\/([^']+)'\)/g;
  while ((match = builderDecl.exec(registrySource))) {
    builderFromPath.set(match[1], `lib/canonical-v2/native-producer/${match[2]}.js`);
  }
  for (const [builder, family] of builders) {
    const path = builderFromPath.get(builder);
    if (path) map.set(family, { builder, path });
  }
  return { map, requireCount: requires.length };
}

function buildConsumerIndex() {
  const records = [];
  const skipped = [];
  const groups = [
    { kind: 'tests', root: resolve(repoRoot, 'tests'), ext: new Set(['.js', '.mjs', '.cjs']) },
    { kind: 'scripts', root: resolve(repoRoot, 'scripts'), ext: new Set(['.js', '.mjs', '.cjs']) },
  ];
  for (const group of groups) {
    for (const file of walkFiles(group.root, (full) => group.ext.has(extname(full)))) {
      const { source, skipped: tooBig } = readIfSmall(file);
      if (tooBig) {
        skipped.push(rel(file));
        continue;
      }
      const lines = activeLines(source);
      const commentFree = lines.join('\n');
      records.push({
        kind: group.kind,
        path: rel(file),
        libs: new Set(requireSpecifiers(commentFree).map((spec) => resolveLibRequire(file, spec)).filter(Boolean)),
        familyTokens: new Set((commentFree.match(/['"][A-Z][A-Z0-9_]+['"]/g) || []).map((token) => token.slice(1, -1))),
        reads: classifyReads(lines),
      });
    }
  }
  return { records, skipped };
}

function scanConsumers(index, componentPaths, familyToken = null) {
  const targets = new Set(componentPaths.map((path) => path.replace(/\\/g, '/')));
  const summary = {
    test_files_requiring: 0,
    test_files_reading_evidence: 0,
    test_files_reading_fixtures: 0,
    script_files_requiring: 0,
    skipped_large_files: index.skipped,
    example_tests: [],
  };
  for (const record of index.records) {
    const hitsComponent = [...targets].some((target) => record.libs.has(target));
    if (!hitsComponent) continue;
    if (familyToken) {
      const slug = familyToken.toLowerCase().replace(/_/g, '-');
      const mentionsFamily = record.familyTokens.has(familyToken)
        || [...record.libs].some((libPath) => libPath.includes(slug));
      if (!mentionsFamily) continue;
    }
    if (record.kind === 'tests') {
      summary.test_files_requiring += 1;
      if (record.reads.reads_evidence) summary.test_files_reading_evidence += 1;
      if (record.reads.reads_fixtures) summary.test_files_reading_fixtures += 1;
      if (summary.example_tests.length < 2) summary.example_tests.push(record.path);
    } else {
      summary.script_files_requiring += 1;
    }
  }
  return summary;
}

function loadWork3() {
  const analysisSet = loadJson(WORK3_ANALYSIS_SET);
  const indexSet = loadJson(WORK3_INDEX_SET);
  const contextSet = loadJson(WORK3_CONTEXT_SET);
  const agreementIds = analysisSet.members.map((member) => member.agreement_id).sort();
  if (agreementIds.length !== 10) {
    throw new Error(`expected 10 Work 3 agreements, got ${agreementIds.length}`);
  }
  return { analysisSet, indexSet, contextSet, agreementIds };
}

function namedDealFolders(work3) {
  const folders = new Map();
  for (const member of work3.analysisSet.members) {
    const path = member.agreement_analysis_binding?.path || '';
    const match = path.match(/m7-generalisation[^/]*\/([^/]+)\//);
    if (match) folders.set(match[1], member.agreement_id);
  }
  return folders;
}

function inferAgreementIdFromPath(path, agreementIds, folders) {
  const byHash = agreementIds.find((agreementId) => path.includes(agreementId));
  if (byHash) return byHash;
  for (const [folder, agreementId] of folders) {
    if (path.includes(`/${folder}/`)) return agreementId;
  }
  return null;
}

function collectWork3Paths(work3) {
  const folders = namedDealFolders(work3);
  const byAgreement = new Map(work3.agreementIds.map((id) => [id, {
    agreement_id: id,
    m2: [],
    m3: [],
    m4: [],
    m5: [],
    m7_generalisation: [],
    other: [],
  }]));

  for (const member of work3.analysisSet.members) {
    const row = byAgreement.get(member.agreement_id);
    if (row) row.m4.push(member.agreement_analysis_binding.path);
  }
  for (const member of work3.indexSet.members) {
    const id = inferAgreementIdFromPath(member.path, work3.agreementIds, folders);
    const row = byAgreement.get(id);
    if (row) row.m2.push(member.path);
  }
  for (const member of work3.contextSet.members || []) {
    const path = member.context_compilation_binding?.path || member.path;
    const id = member.agreement_id
      || inferAgreementIdFromPath(path || '', work3.agreementIds, folders);
    const row = byAgreement.get(id);
    if (row && path) row.m3.push(path);
  }

  const shadowRoot = resolve(repoRoot, 'evidence/canonical-v2/stage-2y-structure-migration/shadow');
  const shadowDirs = [
    'm2', 'm3', 'm4', 'm5', 'm5-correction',
    'm7-generalisation',
    'm7-generalisation-comparison-entry-correction',
    'm7-generalisation-row-correction',
  ].map((name) => resolve(shadowRoot, name));
  const files = [];
  for (const dir of shadowDirs) {
    walkFiles(dir, (full) => extname(full) === '.json', files);
  }
  for (const file of files) {
    const path = rel(file);
    const id = inferAgreementIdFromPath(path, work3.agreementIds, folders);
    if (!id) continue;
    const row = byAgreement.get(id);
    if (path.includes('/m2/') || path.endsWith('.agreement-index.json')) addUnique(row.m2, path);
    else if (path.includes('/m3/') || path.endsWith('.context-compilation.json')) addUnique(row.m3, path);
    else if (path.includes('/m4/') || path.endsWith('.agreement-analysis.json')) addUnique(row.m4, path);
    else if (path.includes('/m5/')) addUnique(row.m5, path);
    else if (path.includes('m7-generalisation')) addUnique(row.m7_generalisation, path);
    else addUnique(row.other, path);
  }
  return [...byAgreement.values()];
}

function addUnique(list, value) {
  if (value && !list.includes(value)) list.push(value);
}

function summarizeWork3(paths, selector) {
  const hits = paths.flatMap(selector);
  const unique = [...new Set(hits)].sort();
  return {
    agreement_count: paths.filter((row) => selector(row).length > 0).length,
    path_count: unique.length,
    paths: unique.slice(0, 3),
    truncated: unique.length > 3,
  };
}

function row({
  id,
  component_path,
  related_paths = [],
  functions,
  input,
  output_schema,
  validation,
  work3_outputs,
  notes = null,
}) {
  return {
    id,
    component_path,
    related_paths,
    functions,
    input,
    output_schema,
    validation: {
      test_files_requiring: validation.test_files_requiring,
      test_files_reading_evidence: validation.test_files_reading_evidence,
      test_files_reading_fixtures: validation.test_files_reading_fixtures,
      script_files_requiring: validation.script_files_requiring,
      example_tests: validation.example_tests,
    },
    work3_outputs,
    ...(notes ? { notes } : {}),
  };
}

function markdownEscape(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function renderMarkdown(inventory) {
  const lines = [
    '# Capability inventory',
    '',
    'Components in `lib/` that produce typed facts or classifications from agreement text, plus the requested reuse-map members. Counts come from loaded registries, `module.exports`, and file-read call sites in `tests/` and `scripts/`. Header comments were not used as totals.',
    '',
    `- Registered section families: **${inventory.counts.registered_section_families}**`,
    `- Family adapters with prompt + shaper: **${inventory.counts.family_adapters}**`,
    `- Table rows: **${inventory.counts.table_rows}**`,
    `- Work 3 agreements: **${inventory.work3_agreement_ids.length}**`,
    '',
    '| Component | Functions | Input | Output schema | Validation (evidence vs fixtures) | Work 3 outputs |',
    '| --- | --- | --- | --- | --- | --- |',
  ];
  for (const item of inventory.rows) {
    const validation = `${item.validation.test_files_requiring} tests require it `
      + `(${item.validation.test_files_reading_evidence} read \`evidence/\`, `
      + `${item.validation.test_files_reading_fixtures} read fixtures/tests); `
      + `${item.validation.script_files_requiring} scripts`;
    const outputs = item.work3_outputs.path_count
      ? `${item.work3_outputs.agreement_count}/10 agreements; ${item.work3_outputs.path_count} paths`
      : 'none found';
    lines.push([
      `\`${item.component_path}\``,
      item.functions.map((name) => `\`${name}\``).join(', '),
      item.input,
      item.output_schema,
      validation,
      outputs,
    ].map(markdownEscape).join(' | ').replace(/^/, '| ').concat(' |'));
  }
  if (inventory.missing_expected.length > 0) {
    lines.push('', '## Expected but not found', '');
    for (const missing of inventory.missing_expected) lines.push(`- ${missing}`);
  } else {
    lines.push('', '## Expected but not found', '', 'None of the requested named components were missing.');
  }
  lines.push(
    '',
    '## Method',
    '',
    '- Family count is `listRegisteredSectionFamilies().length` after loading `producer-prompt-registry.js`, not the file header.',
    '- A test or script depends on a component only when it `require()`s that path (or a resolved relative path to it). A path in a comment is ignored.',
    '- Evidence vs fixture counts are test files that both require the component and pass a path containing `evidence/` or `fixture`/`tests/` to `readFile*` / `createReadStream` / `require(*.json)`.',
    '- Work 3 output paths come from the sealed Work 3 index / context / analysis sets plus filenames under `evidence/canonical-v2/stage-2y-structure-migration/shadow/` that contain one of the ten agreement IDs. Large artefacts were not opened.',
    '- Files larger than 2 MB were not scanned for requires (the 12.8 MB profile set and multi-MB canonical texts are excluded).',
    '',
  );
  return `${lines.join('\n')}\n`;
}

function inspectPromptModule(path, builderName) {
  if (!existsSync(resolve(repoRoot, path))) {
    return { functions: [builderName], response_shape: false, exists: false };
  }
  const mod = require(resolve(repoRoot, path));
  return {
    functions: functionNames(mod),
    response_shape: Boolean(mod.RESPONSE_SHAPE),
    prompt_id: typeof mod.PROMPT_ID === 'string' ? mod.PROMPT_ID : null,
    exists: true,
  };
}

function main() {
  process.stderr.write('inventory: work3 sets\n');
  const work3 = loadWork3();
  process.stderr.write('inventory: work3 paths\n');
  const work3Paths = collectWork3Paths(work3);
  process.stderr.write('inventory: consumer index\n');
  const consumerIndex = buildConsumerIndex();
  process.stderr.write(`inventory: consumers ${consumerIndex.records.length}\n`);

  process.stderr.write('inventory: load registries\n');
  const registryPath = 'lib/canonical-v2/native-producer/producer-prompt-registry.js';
  const providerPath = 'lib/canonical-v2/native-producer/anthropic-provider.js';
  const registry = require(resolve(repoRoot, registryPath));
  const families = registry.listRegisteredSectionFamilies();
  const registrySource = readFileSync(resolve(repoRoot, registryPath), 'utf8');
  const { map: promptByFamily } = parseRegistryPromptPaths(activeLines(registrySource).join('\n'));
  const provider = require(resolve(repoRoot, providerPath));

  const adapterFamilies = [];
  const missingAdapters = [];
  for (const family of families) {
    const adapter = provider.getFamilyAdapter(family);
    if (adapter) adapterFamilies.push(family);
    else missingAdapters.push(family);
  }

  const rows = [];
  const missingExpected = [];

  for (const family of families) {
    const prompt = promptByFamily.get(family);
    const adapter = provider.getFamilyAdapter(family);
    const promptPath = prompt?.path || `lib/canonical-v2/native-producer/${family.toLowerCase()}-producer-prompt.js`;
    const inspected = inspectPromptModule(promptPath, prompt?.builder || '');
    if (!prompt || !existsSync(resolve(repoRoot, promptPath))) {
      missingExpected.push(`section-family extractor prompt module for ${family}`);
    }
    const shaperName = adapter?.response_shaper?.name || null;
    const builderName = adapter?.prompt_builder?.name || prompt?.builder || inspected.functions.find((name) => name.startsWith('build')) || null;
    const lists = adapter?.required_response_lists || [];
    const schemaFiles = findSchemaFiles([family.toLowerCase().replace(/_/g, '-'), 'native-producer']);
    const familySchemaFiles = schemaFiles.filter((path) => path.toLowerCase().includes(family.toLowerCase().replace(/_/g, '-')));
    rows.push(row({
      id: `native-family-${family}`,
      component_path: promptPath,
      related_paths: [providerPath, 'lib/canonical-v2/native-producer/native-extraction-run.js'],
      functions: [builderName, shaperName].filter(Boolean),
      input: 'section `source_text` + `governed_scope` (prompt); model JSON + source bytes (shaper)',
      output_schema: familySchemaFiles.length > 0
        ? familySchemaFiles.join(', ')
        : `no schema file; inline ${inspected.response_shape ? 'RESPONSE_SHAPE + ' : ''}required_response_lists=${JSON.stringify(lists)}`,
      validation: scanConsumers(consumerIndex, [promptPath, providerPath, 'lib/canonical-v2/native-producer/native-extraction-run.js'], family),
      work3_outputs: { agreement_count: 0, path_count: 0, paths: [], truncated: false },
      notes: 'Facts appear only after a provider response is shaped; the prompt builder emits a prompt, not claims.',
    }));
  }

  const extra = [
    {
      id: 'native-extraction-run',
      path: 'lib/canonical-v2/native-producer/native-extraction-run.js',
      functionsHint: ['runNativeExtraction'],
      input: 'full admitted `source_text`, `document_hash`, section references, contract bundle, injected provider',
      output: 'NATIVE_EXTRACTION_RUN receipt + shaped family proposals',
      schemaTokens: ['native-extraction', 'run-receipt'],
      work3: () => ({ agreement_count: 0, path_count: 0, paths: [], truncated: false }),
    },
    {
      id: 'section-family-classifier',
      path: 'lib/canonical-v2/native-producer/section-family-classifier.js',
      functionsHint: ['classifySectionFamily', 'classifyDeterministicSectionFamilies', 'runStage1'],
      input: 'section title + optional article context + optional `source_text`',
      output: '`section_family` + provenance (`SECTION_FAMILY_CLASSIFIER/V1`)',
      schemaTokens: ['section-family-classifier'],
      work3: () => ({ agreement_count: 0, path_count: 0, paths: [], truncated: false }),
    },
    {
      id: 'rubric',
      path: 'lib/rubric.js',
      functionsHint: ['getCodesForType', 'getFeaturesForType', 'isValidCode'],
      input: 'provision type / rubric code (lookup; does not read agreement text)',
      output: 'CODES / FEATURES dictionaries; no schema file',
      schemaTokens: ['rubric'],
      work3: () => ({ agreement_count: 0, path_count: 0, paths: [], truncated: false }),
    },
    {
      id: 'm2-agreement-index',
      path: 'lib/canonical-v2/agreement-index.js',
      functionsHint: ['indexAgreement'],
      input: 'exact source (`canonical_text` + hashes) + structural policy',
      output: '`AGREEMENT_INDEX/V1` nodes / spans / coverage',
      schemaTokens: ['agreement-index'],
      work3: () => summarizeWork3(work3Paths, (row) => row.m2),
    },
    {
      id: 'm3-context-compilation',
      path: 'lib/canonical-v2/context-compilation.js',
      functionsHint: ['compileContext'],
      input: 'focus node ids + `AGREEMENT_INDEX/V1` + semantic policy',
      output: '`CONTEXT_COMPILATION/V1` facts, scopes, relationships',
      schemaTokens: ['context-compilation'],
      work3: () => summarizeWork3(work3Paths, (row) => row.m3),
    },
    {
      id: 'm4-agreement-analysis',
      path: 'lib/canonical-v2/agreement-analysis.js',
      functionsHint: ['analyseAgreement'],
      input: '`AGREEMENT_INDEX/V1` + analysis task (legacy write-set / context / policy)',
      output: '`AGREEMENT_ANALYSIS/V1` claims and evidence edges',
      schemaTokens: ['agreement-analysis'],
      work3: () => summarizeWork3(work3Paths, (row) => row.m4),
    },
    {
      id: 'm7-deterministic-generalisation',
      path: 'lib/canonical-v2/m7-deterministic-generalisation.js',
      functionsHint: ['selectFamilySections', 'buildBaseAnalysis', 'deriveSemanticPolicy'],
      input: 'M2 index (+ optional M3) and family order; reads node text via UTF-8 byte spans',
      output: 'family bindings + `AGREEMENT_ANALYSIS_CLAIM/V1` source-provision claims',
      schemaTokens: ['generalisation', 'compound-proposition'],
      work3: () => summarizeWork3(work3Paths, (row) => row.m7_generalisation.concat(row.m5)),
    },
    {
      id: 'family-compound-adapter',
      path: 'lib/canonical-v2/family-compound-adapter.js',
      functionsHint: ['adaptCompoundFamily', 'policyForFamily'],
      input: 'M4 analysis + M2 index + M3 compilation + family policy (not raw text)',
      output: '`STAGE_2Y_M5_COMPOUND_ADAPTER_RESULT/V1` propositions',
      schemaTokens: ['compound-adapter', 'family-compound'],
      work3: () => summarizeWork3(work3Paths, (row) => row.m5.filter((path) => path.includes('/m5/families/') || path.endsWith('/adapter.json'))),
    },
    {
      id: 'm7-v2-deterministic-generator',
      path: 'lib/canonical-v2/m7-v2-deterministic-generator.js',
      functionsHint: ['generateAnalysisV2', 'compileSyntheticProfileExpression'],
      input: 'M4 + M2 + M3 + approved profiles; matches `match_test` tokens against M2 `canonical_text`',
      output: '`AGREEMENT_ANALYSIS/V2` (inline schema constants; no schema file)',
      schemaTokens: ['m7-v2', 'agreement-analysis'],
      work3: () => ({ agreement_count: 0, path_count: 0, paths: [], truncated: false }),
    },
    {
      id: 'parser-v2-classify',
      path: 'lib/parser-v2/classify.js',
      functionsHint: ['classifySections', 'tryDeterministic'],
      input: 'parser sections/articles + optional model client',
      output: 'provision_type / subcodes on sections; no schema file',
      schemaTokens: ['classify'],
      work3: () => ({ agreement_count: 0, path_count: 0, paths: [], truncated: false }),
    },
    {
      id: 'parser-v2-extract',
      path: 'lib/parser-v2/extract.js',
      functionsHint: ['extractProvisions', 'extractProvisionsForType'],
      input: 'classified sections + full cleaned text + model client',
      output: 'provision cards with rubric codes and FEATURES; no dedicated schema file',
      schemaTokens: ['extract', 'provision-card'],
      work3: () => ({ agreement_count: 0, path_count: 0, paths: [], truncated: false }),
    },
    {
      id: 'transaction-steps-detector',
      path: 'lib/parser-v2/detectors/transaction-steps.js',
      functionsHint: ['extractTransactionSteps', 'extractDetectorTransactionSteps'],
      input: 'classified STRUCT/CONSID/DEF section text',
      output: 'ordered transaction_steps + topology via `lib/schema/topology-detector.js`',
      schemaTokens: ['topology'],
      work3: () => ({ agreement_count: 0, path_count: 0, paths: [], truncated: false }),
    },
  ];

  for (const item of extra) {
    const abs = resolve(repoRoot, item.path);
    if (!existsSync(abs)) {
      missingExpected.push(item.path);
      continue;
    }
    const mod = require(abs);
    const exported = functionNames(mod);
    const schemaFiles = findSchemaFiles(item.schemaTokens);
    const schemaConstantsList = schemaConstants(mod);
    let outputSchema = 'no schema file';
    if (schemaFiles.length > 0) outputSchema = schemaFiles.join(', ');
    else if (schemaConstantsList.length > 0) outputSchema = `no schema file; ${schemaConstantsList.slice(0, 4).join('; ')}`;
    else if (item.output) outputSchema = item.output.includes('no schema') || item.output.includes('`')
      ? item.output
      : `no schema file; ${item.output}`;
    rows.push(row({
      id: item.id,
      component_path: item.path,
      related_paths: item.id === 'transaction-steps-detector'
        ? ['lib/schema/topology-detector.js']
        : [],
      functions: exported.length > 0 ? exported.filter((name) => item.functionsHint.includes(name) || exported.length <= 8) : item.functionsHint,
      input: item.input,
      output_schema: schemaFiles.length > 0 ? schemaFiles.join(', ') : (item.output.includes('no schema') ? item.output : outputSchema),
      validation: scanConsumers(consumerIndex, [item.path, ...(item.id === 'transaction-steps-detector' ? ['lib/schema/topology-detector.js'] : [])]),
      work3_outputs: item.work3(),
    }));
  }

  for (const expected of [
    'lib/canonical-v2/m7-deterministic-generalisation.js',
    'lib/canonical-v2/family-compound-adapter.js',
    'lib/rubric.js',
    'lib/canonical-v2/agreement-index.js',
    'lib/canonical-v2/context-compilation.js',
    'lib/canonical-v2/agreement-analysis.js',
  ]) {
    if (!existsSync(resolve(repoRoot, expected))) missingExpected.push(expected);
  }
  if (families.length !== 25) {
    missingExpected.push(`expected 25 registered section families, counted ${families.length}`);
  }
  for (const family of missingAdapters) {
    missingExpected.push(`FAMILY_ADAPTERS missing ${family}`);
  }

  const inventory = {
    generated_from: rel(new URL(import.meta.url).pathname),
    work3_agreement_ids: work3.agreementIds,
    counts: {
      registered_section_families: families.length,
      family_adapters: adapterFamilies.length,
      table_rows: rows.length,
    },
    missing_expected: missingExpected,
    rows,
  };

  const markdown = renderMarkdown(inventory);
  writeFileSync(resolve(OUT_DIR, 'CAPABILITY-INVENTORY.md'), markdown);
  process.stdout.write(`${JSON.stringify(inventory, null, 2)}\n`);
}

main();
