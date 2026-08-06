'use strict';

const fs = require('node:fs');
const { assertProductionAuthority } = require('./v1-apply-guard');

const BACKUP_SCHEMA = 'V1_RECLASS_DEAL_BACKUP/V2';
const CORE_TABLES = Object.freeze(['deals', 'parser_regions', 'provisions', 'provision_cards', 'claims']);
const DEAL_ID_FIELD = Object.freeze({ deals: 'id' });
const INCOMPLETE_GRAPH_REASON = 'The backup does not capture every dependent and cascade child table.';

function assertFixtureDeal(dealId) {
  if (typeof dealId !== 'string' || !/^[0-9a-f-]{36}$/.test(dealId)) throw new Error('A concrete deal UUID is required.');
}
async function rowsForDeal(sb, table, dealId) {
  const field = DEAL_ID_FIELD[table] || 'deal_id';
  const { data, error } = await sb.from(table).select('*').eq(field, dealId);
  if (error) throw new Error(`Backup failed for ${table}: ${error.message}`);
  return data || [];
}
function assertBackupCoverage(backup, dealId) {
  if (!backup || !Array.isArray(backup.dealIds) || !backup.dealIds.includes(dealId)) throw new Error('The backup does not cover the requested deal.');
  if (backup.schema !== BACKUP_SCHEMA || !CORE_TABLES.every((table) => Array.isArray(backup[table]))) throw new Error('The backup does not contain the required core deal tables.');
  if (backup.deals.length !== 1 || backup.deals[0].id !== dealId) throw new Error('The backup does not contain exactly the requested deal record.');
}
function assertCompleteGraphForRestore(backup) {
  if (backup.graph?.complete !== true) {
    const error = new Error(`Restore refused: ${INCOMPLETE_GRAPH_REASON}`);
    error.code = 'V1_RESTORE_INCOMPLETE_GRAPH';
    throw error;
  }
}
async function dumpDealBackup(sb, dealId, backupPath) {
  assertFixtureDeal(dealId);
  if (fs.existsSync(backupPath)) throw new Error(`Backup path already exists, refusing to overwrite: ${backupPath}`);
  const values = await Promise.all(CORE_TABLES.map((table) => rowsForDeal(sb, table, dealId)));
  const backup = {
    schema: BACKUP_SCHEMA,
    dumpedAt: new Date().toISOString(),
    dealIds: [dealId],
    ...Object.fromEntries(CORE_TABLES.map((table, index) => [table, values[index]])),
    graph: Object.freeze({ complete: false, restore_disposition: 'REFUSE_UNTIL_FULL_DEPENDENT_GRAPH_IS_CAPTURED', reason: INCOMPLETE_GRAPH_REASON }),
  };
  assertBackupCoverage(backup, dealId);
  fs.writeFileSync(backupPath, `${JSON.stringify(backup, null, 2)}\n`, { flag: 'wx' });
  return backup;
}
function idOf(row) { return row.id; }
function restorePlan(backupRows, currentRows) {
  const backupIds = new Set(backupRows.map(idOf));
  const currentIds = new Set(currentRows.map(idOf));
  return {
    upsert: backupRows.filter((row) => !currentIds.has(idOf(row)) || JSON.stringify(currentRows.find((current) => idOf(current) === idOf(row))) !== JSON.stringify(row)),
    delete_orphan_ids: currentRows.filter((row) => !backupIds.has(idOf(row))).map(idOf),
  };
}
async function restoreDealFromBackup(sb, backup, dealId, { apply = false, authority = null } = {}) {
  assertFixtureDeal(dealId);
  assertBackupCoverage(backup, dealId);
  const current = {};
  for (const table of CORE_TABLES) current[table] = await rowsForDeal(sb, table, dealId);
  const plan = Object.fromEntries(CORE_TABLES.map((table) => [table, restorePlan(backup[table], current[table])]));
  if (!apply) return { apply: false, dealId, plan, restore_permitted: backup.graph?.complete === true };
  assertProductionAuthority({ ...(authority || {}), operation: { apply, dealId } });
  assertCompleteGraphForRestore(backup);
  if (Object.values(plan).some((part) => part.delete_orphan_ids.length)) {
    const error = new Error('Restore refused: orphan deletion can cascade to rows outside this scaffold.');
    error.code = 'V1_RESTORE_CASCADE_DELETE_REFUSED';
    throw error;
  }
  for (const table of CORE_TABLES) {
    const part = plan[table];
    if (part.upsert.length) {
      const { error } = await sb.from(table).upsert(part.upsert);
      if (error) throw new Error(`Restore upsert failed for ${table}: ${error.message}`);
    }
  }
  return { apply: true, dealId, plan };
}

module.exports = { BACKUP_SCHEMA, CORE_TABLES, INCOMPLETE_GRAPH_REASON, assertBackupCoverage, dumpDealBackup, restoreDealFromBackup, restorePlan };
