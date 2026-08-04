'use strict';
const assert = require('node:assert/strict'); const path = require('node:path'); const test = require('node:test');
test('eligibility report rejects a snapshot without verified issued identity evidence before comparison', async () => { const report = await import(path.join('..', 'scripts', 'nets-eligibility-report.mjs')); await assert.rejects(() => report.runTwoPassFlow({ runReceipt: {}, admittedSourceContext: {}, snapshot: {} }), /lacks verified issued identity binding/); });
