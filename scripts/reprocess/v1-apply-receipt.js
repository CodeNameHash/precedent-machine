'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const RETIRED_SUBTYPES = Object.freeze(['REP-T-APPROVAL', 'REP-T-CONSENT', 'REP-B-ANTIRELIANCE', 'MISC-BOILERPLATE', 'REP-T-REGSTATUS']);
const COUNT_TABLES = Object.freeze(['provisions', 'provision_cards', 'claims']);

async function count(sb, table, dealId, field, value) {
  let q = sb.from(table).select('*', { count: 'exact', head: true }).eq('deal_id', dealId);
  if (field) q = q.eq(field, value);
  const { count: n, error } = await q;
  if (error) throw new Error(`Count failed for ${table}: ${error.message}`);
  return n || 0;
}
async function captureCounts(sb, dealId) {
  const [provisions, provision_cards, claims, by_extraction_version, retired_subtypes] = await Promise.all([
    count(sb, 'provisions', dealId), count(sb, 'provision_cards', dealId), count(sb, 'claims', dealId),
    count(sb, 'provision_cards', dealId, 'extraction_version', 'm2-01-reclass-v1'),
    Promise.all(RETIRED_SUBTYPES.map(async (code) => [code, await count(sb, 'provision_cards', dealId, 'provision_subtype', code)])),
  ]);
  return { provisions, provision_cards, claims, provision_cards_by_extraction_version: by_extraction_version, provision_cards_by_retired_subtype: Object.fromEntries(retired_subtypes) };
}
function diffCounts(before, after) {
  return Object.fromEntries(COUNT_TABLES.map((key) => [key, { before: before[key], after: after[key], delta: after[key] - before[key] }]));
}
function normaliseAffectedIds(affectedIds = {}) {
  const keys = Object.keys(affectedIds).sort();
  if (keys.join(',') !== [...COUNT_TABLES].sort().join(',')) throw new Error('Affected IDs must be grouped by every reconciled table.');
  const result = {};
  for (const table of COUNT_TABLES) {
    const part = affectedIds[table];
    if (!part || typeof part !== 'object' || Object.keys(part).sort().join(',') !== 'added,changed,removed') throw new Error(`Affected IDs for ${table} must contain added, removed and changed lists.`);
    result[table] = {};
    for (const key of ['added', 'removed', 'changed']) {
      if (!Array.isArray(part[key]) || new Set(part[key]).size !== part[key].length) throw new Error(`Affected IDs for ${table}.${key} must be a unique list.`);
      result[table][key] = [...part[key]];
    }
    if (new Set([...result[table].added, ...result[table].removed]).size !== result[table].added.length + result[table].removed.length) throw new Error(`Affected IDs for ${table} cannot be both added and removed.`);
  }
  return result;
}
function validateReceipt(receipt) {
  if (!receipt || typeof receipt !== 'object' || !receipt.step || !receipt.dealId || !receipt.before || !receipt.after) throw new Error('Receipt is missing required identity or count fields.');
  const expected = diffCounts(receipt.before, receipt.after);
  if (JSON.stringify(receipt.delta) !== JSON.stringify(expected)) throw new Error('Receipt delta does not reconcile to its before and after counts.');
  const affectedIds = normaliseAffectedIds(receipt.affectedIds);
  for (const table of COUNT_TABLES) {
    const change = receipt.delta[table];
    if (affectedIds[table].added.length - affectedIds[table].removed.length !== change.delta) throw new Error(`Affected IDs for ${table} do not reconcile to the recorded row delta.`);
  }
  return true;
}
function buildReceipt({ step, dealId, dealLabel, before, after, affectedIds, backupFile, gitRef, generatedAt }) {
  const body = Object.freeze({
    step, dealId, dealLabel, generatedAt: generatedAt || new Date().toISOString(), gitRef: gitRef || null,
    before, after, delta: diffCounts(before, after), affectedIds: normaliseAffectedIds(affectedIds), backupFile,
  });
  validateReceipt(body);
  return body;
}
function writeReceiptFile(receipt, reportsDirectory = 'reports') {
  validateReceipt(receipt);
  const stamp = receipt.generatedAt.replace(/[:.]/g, '-');
  const file = path.join(reportsDirectory, `v1-apply-${receipt.step}-${receipt.dealId.slice(0, 8)}-${stamp}.json`);
  fs.mkdirSync(reportsDirectory, { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(receipt, null, 2)}\n`, { flag: 'wx' });
  return file;
}
function receiptId(receipt) { validateReceipt(receipt); return crypto.createHash('sha256').update(JSON.stringify(receipt)).digest('hex'); }

module.exports = { COUNT_TABLES, RETIRED_SUBTYPES, buildReceipt, captureCounts, diffCounts, normaliseAffectedIds, receiptId, validateReceipt, writeReceiptFile };
