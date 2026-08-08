#!/usr/bin/env node
/**
 * Step 2X-B corpus pass (DECISIONS.md §15 HOLD).
 *
 * For general-covenants, guaranty, and tax-cooperation: find quotes where the
 * primary corroboration table misses but the legacy/scaffold second chance
 * would hit, and print those quotes. Does not change resolution.
 *
 *   node scripts/canonical-v2-second-chance-would-resolve-report.mjs
 *   node scripts/canonical-v2-second-chance-would-resolve-report.mjs --write docs/codex-program/notes/step-2x-b-second-chance-corpus-pass.md
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  generalCovenantPrimaryMatchingCodes,
  corroborateGeneralCovenantCode,
} = require('../lib/canonical-v2/native-producer/general-covenant-corroboration.js');
const { rubricPresentationCodeMatches } = require('../lib/vocab/general-covenant-rubric-presentation.js');
const {
  primaryGuarantyKindMatches,
  corroborateGuarantyKind,
  GUARANTY_ASSERTION_KINDS,
} = require('../lib/canonical-v2/native-producer/guaranty-corroboration.js');
const { legacyGuarantyKindMatches } = require('../lib/vocab/guaranty-assertion-legacy.js');
const {
  taxCooperationPrimaryMatchingKinds,
  corroborateTaxOpinionCooperation,
  corroborateTransferCooperation,
} = require('../lib/canonical-v2/native-producer/tax-cooperation-corroboration.js');
const { taxCooperationLegacyKindMatches } = require('../lib/vocab/tax-cooperation-legacy.js');

const ROOT = path.resolve('evidence/canonical-v2');
const writeIdx = process.argv.indexOf('--write');
const writePath = writeIdx >= 0 ? process.argv[writeIdx + 1] : null;

function listRunDirs() {
  if (!fs.existsSync(ROOT)) return [];
  return fs.readdirSync(ROOT)
    .map((name) => path.join(ROOT, name))
    .filter((p) => fs.existsSync(path.join(p, 'resolution.json')));
}

function quoteFromEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  if (typeof entry.raw_value === 'string' && entry.raw_value.length) return entry.raw_value;
  if (typeof entry.claim?.raw_value === 'string' && entry.claim.raw_value.length) return entry.claim.raw_value;
  const ev = entry.evidence || entry.claim?.evidence;
  if (Array.isArray(ev) && ev[0]?.quote) return ev[0].quote;
  return null;
}

function collectEntries(resolution) {
  const out = [];
  for (const key of ['resolved', 'review_queue', 'open_world']) {
    const list = resolution[key];
    if (!Array.isArray(list)) continue;
    for (const entry of list) out.push({ bucket: key, entry });
  }
  return out;
}

const hits = {
  general_covenants: [],
  guaranty: [],
  tax_cooperation: [],
};
let runs = 0;

for (const dir of listRunDirs()) {
  runs += 1;
  const dealFamily = path.basename(dir);
  let resolution;
  try {
    resolution = JSON.parse(fs.readFileSync(path.join(dir, 'resolution.json'), 'utf8'));
  } catch {
    continue;
  }
  for (const { bucket, entry } of collectEntries(resolution)) {
    const quote = quoteFromEntry(entry);
    if (!quote) continue;
    const attrs = entry.attributes || entry.claim?.attributes || {};
    const key = entry.claim_definition_key || entry.claim?.claim_definition_key || '';

    if (String(key).includes('GENERAL_COVENANT') || /^GENERAL_COVENANT_/.test(String(entry.reason || ''))) {
      const code = attrs.covenant_code || entry.canonical_value;
      if (!code) continue;
      const primary = generalCovenantPrimaryMatchingCodes(quote);
      if (primary.length !== 0) continue;
      const v1 = rubricPresentationCodeMatches(quote);
      if (v1.length === 1 && v1[0] === code) {
        hits.general_covenants.push({
          run: dealFamily, bucket, code, quote, provenance: 'V1_GENERAL_COVENANT_RUBRIC_PRESENTATION',
        });
      }
      continue;
    }

    if (String(key).includes('GUARANTY') || GUARANTY_ASSERTION_KINDS.includes(attrs.assertion_kind)) {
      const kind = attrs.assertion_kind;
      if (!GUARANTY_ASSERTION_KINDS.includes(kind)) continue;
      if (primaryGuarantyKindMatches(quote).length !== 0) continue;
      const v1 = legacyGuarantyKindMatches(quote);
      if (v1.length === 1 && v1[0] === kind) {
        hits.guaranty.push({
          run: dealFamily, bucket, kind, quote, provenance: 'V1_GUARANTY_ASSERTION_LEGACY',
        });
      }
      continue;
    }

    if (attrs.assertion_kind === 'TAX_OPINION_COOPERATION' || attrs.assertion_kind === 'TRANSFER_COOPERATION') {
      const kind = attrs.assertion_kind;
      if (taxCooperationPrimaryMatchingKinds(quote).length !== 0) continue;
      const v1 = taxCooperationLegacyKindMatches(quote);
      if (v1.length === 1 && v1[0] === kind) {
        hits.tax_cooperation.push({
          run: dealFamily, bucket, kind, quote, provenance: 'V1_TAX_COOPERATION_LEGACY',
        });
      }
    }
  }
}

function section(title, rows, idKey) {
  const lines = [`## ${title}`, '', `Would-resolve hits: **${rows.length}**`, ''];
  if (!rows.length) {
    lines.push('_None on committed resolution.json quotes._', '');
    return lines;
  }
  for (const row of rows) {
    lines.push(`### ${row.run} · ${row.bucket} · \`${row[idKey]}\``);
    lines.push('');
    lines.push('```');
    lines.push(row.quote.length > 800 ? `${row.quote.slice(0, 800)}…` : row.quote);
    lines.push('```');
    lines.push('');
  }
  return lines;
}

const md = [
  '# Step 2X-B second-chance corpus pass',
  '',
  'Generated by `node scripts/canonical-v2-second-chance-would-resolve-report.mjs`.',
  'DECISIONS.md §15: scaffolds are HOLD / report-only until this report is reviewed.',
  'Primary-hit path untouched; these are primary-miss rows the legacy scaffold would newly resolve.',
  '',
  `Runs scanned (with resolution.json): **${runs}**`,
  '',
  `| family | would-resolve |`,
  `|---|---:|`,
  `| general_covenants | ${hits.general_covenants.length} |`,
  `| guaranty | ${hits.guaranty.length} |`,
  `| tax_cooperation | ${hits.tax_cooperation.length} |`,
  '',
  ...section('General covenants (rubric-presentation scaffold)', hits.general_covenants, 'code'),
  ...section('Guaranty (relaxed legacy scaffold)', hits.guaranty, 'kind'),
  ...section('Tax cooperation (legacy scaffold)', hits.tax_cooperation, 'kind'),
  '## Disposition',
  '',
  'Awaiting Ben review before any second-chance promotion.',
  '',
].join('\n');

if (writePath) {
  fs.mkdirSync(path.dirname(writePath), { recursive: true });
  fs.writeFileSync(writePath, md);
  console.log(`wrote ${writePath}`);
} else {
  process.stdout.write(md);
}
console.error(JSON.stringify({
  runs,
  general_covenants: hits.general_covenants.length,
  guaranty: hits.guaranty.length,
  tax_cooperation: hits.tax_cooperation.length,
}, null, 2));
