'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('Stage 2Y-E replay is pinned, report-only, and keeps rung 0 below spelled-alone adoption', () => {
  const root = path.resolve(__dirname, '..');
  const script = path.join(root, 'scripts', 'stage-2y-e-numeral-ladder-replay.mjs');
  const run = spawnSync(process.execPath, [script, '--check'], { cwd: root, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const evidence = JSON.parse(fs.readFileSync(path.join(root, 'evidence/canonical-v2/stage-2y-e-numeral-ladder-replay.json'), 'utf8'));
  assert.deepEqual(
    {
      final_run_count: evidence.final_run_count,
      affected_recording_count: evidence.affected_recording_count,
      model_calls: evidence.model_calls,
      writes: evidence.writes,
      production_activation: evidence.production_activation,
      counts: evidence.rungs.map((rung) => rung.counts),
    },
    {
      final_run_count: 157,
      affected_recording_count: 19,
      model_calls: 0,
      writes: false,
      production_activation: false,
      counts: [
        { RESOLVED: 10, ABSTAIN: 9 },
        { RESOLVED: 10, ABSTAIN: 9 },
        { RESOLVED: 15, ABSTAIN: 4 },
        { RESOLVED: 15, ABSTAIN: 4 },
      ],
    },
  );
});
