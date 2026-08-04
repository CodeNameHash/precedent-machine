'use strict';

const path = require('node:path');
const { buildV1RenderCaptureExecutionPreflight } = require('../lib/canonical-v2/v1-render-capture-preflight');

function argument(name) { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] || null; }
const preflight = buildV1RenderCaptureExecutionPreflight({
  repository_root: argument('--repository-root'),
  durable_output_root: argument('--durable-output-root'),
  reviewer_mode: argument('--reviewer-mode') === 'true',
});
process.stdout.write(`${JSON.stringify(preflight, null, 2)}\n`);
