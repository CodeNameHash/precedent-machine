#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"

node - "$ROOT" <<'NODE'
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = process.argv[2] || '.';

const globalPatterns = [
  'ITM only',
  'Consideration:\\s*Cash',
  'MAE\\s*\\(partial\\)',
  'Question\\s*:.*\\|.*Answer\\s*:',
  'applies to Parent and Company',
  'maeAppliesToBoth',
  'Must defend \\(incl\\. appeals/final judgment\\)',
  'QUALIFICATION.*litigation',
  'burdensome.*closing.condition',
  'Substantial Detriment.*closing',
  'Exchange Ratio Type.*Floating.*Exchange Ratio Type.*Fixed',
  'TOOLTIP_MAX\\s*=\\s*600',
  'FullDocumentView\\s+provisions=\\{provisions\\}(?!.*focusProvisionId)',
  'term-cell.*Company pre-closing.*base salary',
  'antitrust-substantive-table.*<button.*onClick',
  "field_path\\s*:\\s*['\"][a-z_]+['\"]",
  "provision_type\\s*:\\s*['\"][A-Z_]+['\"]\\s*,\\s*field_path",
  '\\\\.only\\(',
  '\\\\.skip\\(',
  '\\\\bxit\\(',
  'any\\s*<any>',
  ':\\s*string\\s*=',
  'Mergers,\\s*Acquisitions,\\s*Dispositions',
  'class="definition-term"(?!.*wrapped)',
];

const scopedPatterns = [
  'TSA|transition services agreement',
  'TODO\\s*[:—-].*market',
  'FIXME.*market',
  'console\\.log',
];

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(root, full).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      if (['node_modules', '.next', 'docs', '.git', '.claude', '.vercel'].includes(entry.name)) continue;
      walk(full, files);
    } else if (
      rel !== 'scripts/lint/forbidden-patterns.sh' &&
      rel !== 'pm-master-straitjacket.codex.md'
    ) {
      files.push({ full, rel });
    }
  }
  return files;
}

function normalize(file) {
  return String(file || '').replace(/\\/g, '/').replace(/^\.\//, '').trim();
}

function changedFiles() {
  if (process.env.CHANGED_FILES) {
    return process.env.CHANGED_FILES.split(/\r?\n/).map(normalize).filter(Boolean);
  }
  function diffNames(ref) {
    return execFileSync('git', ['diff', '--name-only', ref], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .split(/\r?\n/)
      .map(normalize)
      .filter(Boolean);
  }
  const refs = ['origin/main...HEAD', 'main...HEAD'];
  for (const ref of refs) {
    try {
      return diffNames(ref);
    } catch (_) {
      // Try the next base ref.
    }
  }
  if (process.env.GITHUB_ACTIONS && process.env.GITHUB_BASE_REF && process.env.GITHUB_HEAD_REF) {
    const base = process.env.GITHUB_BASE_REF;
    const head = process.env.GITHUB_HEAD_REF;
    try {
      execFileSync('git', [
        'fetch',
        '--no-tags',
        '--depth=200',
        'origin',
        `+refs/heads/${base}:refs/remotes/origin/${base}`,
        `+refs/heads/${head}:refs/remotes/origin/${head}`,
      ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      return diffNames(`origin/${base}..origin/${head}`);
    } catch (_) {
      // Try the single-parent checkout fallback below.
    }
  }
  try {
    return diffNames('HEAD^1..HEAD');
  } catch (_) {
    // Fall back to a full scan below.
  }
  return walk(root).map((file) => file.rel);
}

function scopedFile(rel) {
  return /OtherCovenants|other-covenants|market-registry|registry|newhome/.test(rel);
}

const failures = [];
for (const rel of changedFiles()) {
  if (
    !rel ||
    rel.startsWith('node_modules/') ||
    rel.startsWith('.next/') ||
    rel.startsWith('docs/') ||
    rel.startsWith('.git/') ||
    rel.startsWith('.claude/') ||
    rel.startsWith('.vercel/') ||
    rel.startsWith('scripts/lint/') ||
    rel === 'pm-master-straitjacket.codex.md'
  ) {
    continue;
  }
  const full = path.join(root, rel);
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) continue;
  const src = fs.readFileSync(full, 'utf8');
  for (const pattern of globalPatterns) {
    if (new RegExp(pattern, 'im').test(src)) {
      failures.push(`${rel} :: ${pattern}`);
    }
  }
  if (scopedFile(rel)) {
    for (const pattern of scopedPatterns) {
      if (new RegExp(pattern, 'im').test(src)) {
        failures.push(`${rel} :: ${pattern}`);
      }
    }
  }
}

if (failures.length) {
  process.stdout.write(`INVARIANT-4: FAIL ${failures[0]}\n`);
  process.exit(1);
}

process.stdout.write('INVARIANT-4: PASS\n');
NODE
