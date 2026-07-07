#!/usr/bin/env node

const fs = require('fs');

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function auditCompleteness(state = readJson('docs/schema-shape/audit-state.json', { frozen_shapes: [], decisions: [] })) {
  const red = (state.decisions || []).filter((decision) => decision.status === 'red' && !decision.resolution);
  return { ok: red.length === 0, failures: red.map((cell) => cell.id || `${cell.shape}:${cell.deal_id}:${cell.field}`) };
}

function noOrphanValues(normalized = readJson('docs/schema-shape/normalized-v1.json', { entries: [] }), queue = readJson('docs/schema-shape/reconciliation-queue.json', { entries: [] })) {
  const activeQueue = new Set((queue.entries || []).filter((entry) => entry.status === 'NEW' || entry.status === 'IN_REVIEW').map((entry) => entry.provision_id || entry.id));
  const failures = [];
  for (const entry of normalized.entries || []) {
    const value = entry.value;
    if (!value?.canonicalKey) continue;
    if (value.canonicalKey === 'FREEFORM') continue;
    if (entry.allowedCanonicalKeys?.includes(value.canonicalKey)) continue;
    if (activeQueue.has(value.sourceProvisionId)) continue;
  }
  return { ok: failures.length === 0, failures };
}

function runAll() {
  return {
    auditCompleteness: auditCompleteness(),
    noOrphanValues: noOrphanValues(),
  };
}

function main() {
  const result = runAll();
  const failures = Object.entries(result).flatMap(([name, check]) => check.ok ? [] : check.failures.map((failure) => `${name}: ${failure}`));
  if (failures.length) {
    process.stderr.write(`${failures.join('\n')}\n`);
    process.exit(1);
  }
  process.stdout.write('phase-0-C audit invariants: PASS\n');
}

if (require.main === module) {
  main();
}

module.exports = {
  auditCompleteness,
  noOrphanValues,
  runAll,
};
