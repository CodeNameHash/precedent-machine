#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  INITIAL_IMPORT_COUNT,
  buildInitialImportProposalPacket,
} = require('../lib/canonical-v2/governed-identity-proposal-packet');

const [outputRoot, directoryPath = path.resolve(__dirname, '../lib/generated/home-deal-directory-v1.json')] = process.argv.slice(2);
if (!outputRoot) throw new Error('usage: write-governed-identity-proposal-packet.js <empty-output-directory> [directory-inventory.json]');

const rawDirectory = fs.readFileSync(directoryPath);
const directory = JSON.parse(rawDirectory.toString('utf8'));
if (!directory || !Array.isArray(directory.deals) || directory.deals.length !== INITIAL_IMPORT_COUNT) {
  throw new Error(`initial-import inventory must contain exactly ${INITIAL_IMPORT_COUNT} rows`);
}
if (!fs.existsSync(outputRoot) || !fs.statSync(outputRoot).isDirectory()) {
  throw new Error('output directory must already exist');
}
const outputPath = path.join(outputRoot, 'governed-identity-initial-import-proposal-packet.json');
if (fs.existsSync(outputPath)) throw new Error('refuses to overwrite an existing proposal packet');

const packet = buildInitialImportProposalPacket({
  initial_import_source_inventory_digest: crypto.createHash('sha256').update(rawDirectory).digest('hex'),
});
fs.writeFileSync(outputPath, `${JSON.stringify(packet, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
console.log(outputPath);
