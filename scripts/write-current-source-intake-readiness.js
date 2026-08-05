#!/usr/bin/env node
'use strict';

const {
  tripleRebuildAndWriteCurrentSourceIntakeReadinessMaterialisation,
} = require('../lib/canonical-v2/source-intake-readiness-writer');

const [artifactRoot] = process.argv.slice(2);
if (!artifactRoot) throw new Error('usage: write-current-source-intake-readiness.js <durable-artifact-root>');
const result = tripleRebuildAndWriteCurrentSourceIntakeReadinessMaterialisation({ artifact_root: artifactRoot });
process.stdout.write(`${JSON.stringify(result)}\n`);
