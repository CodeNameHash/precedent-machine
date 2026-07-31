#!/usr/bin/env node

import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const {
  loadSealedMetseraGoldEvidence,
} = require('../lib/canonical-v2/metsera-gold-evidence');
const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');

const USER_AGENT = 'precedent-machine research bengoodchild@gmail.com';
const REQUEST_DELAY_MS = 400;

function readArg(flag) {
  const index = process.argv.indexOf(flag);
  const value = index < 0 ? null : process.argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`fetch-metsera-sealed-sources requires ${flag} <value>.`);
  }
  return value;
}

function sleep(ms) {
  return new Promise((resolveSleep) => {
    setTimeout(resolveSleep, ms);
  });
}

async function fetchDocument(officialUrl) {
  const response = await fetch(officialUrl, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText} for ${officialUrl}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function main() {
  const outDir = resolve(readArg('--out-dir'));
  mkdirSync(outDir, { recursive: true });

  const { sourceUniverse } = loadSealedMetseraGoldEvidence();
  const results = [];
  let failureCount = 0;

  for (let index = 0; index < sourceUniverse.documents.length; index += 1) {
    const document = sourceUniverse.documents[index];
    if (index > 0) {
      // eslint-disable-next-line no-await-in-loop
      await sleep(REQUEST_DELAY_MS);
    }
    let status = 'FAILED';
    let reason = null;
    try {
      // eslint-disable-next-line no-await-in-loop
      const bytes = await fetchDocument(document.officialUrl);
      if (bytes.length !== document.byteLength) {
        reason = `byteLength mismatch: expected ${document.byteLength}, got ${bytes.length}`;
      } else if (sha256Hex(bytes) !== document.sha256) {
        reason = `sha256 mismatch: expected ${document.sha256}, got ${sha256Hex(bytes)}`;
      } else {
        writeFileSync(join(outDir, `${document.accession}.htm`), bytes);
        status = 'VERIFIED';
      }
    } catch (error) {
      reason = error.message;
    }
    if (status !== 'VERIFIED') failureCount += 1;
    results.push({ accession: document.accession, status, reason });
    process.stdout.write(
      `${status} ${document.accession} ${document.officialUrl}${reason ? ` (${reason})` : ''}\n`,
    );
  }

  if (failureCount > 0) {
    process.stderr.write(
      `${failureCount} of ${results.length} sealed sources failed verification. No partial files were written for failed sources.\n`,
    );
    process.exitCode = 1;
    return;
  }
  process.stdout.write(
    `All ${results.length} sealed sources fetched and verified into ${outDir}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
