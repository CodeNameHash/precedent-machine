'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');

const ROOT = path.resolve(__dirname, '..');
const RUNNER = path.join(ROOT, 'scripts', 'canonical-v2-live-extraction-run.mjs');
const RUNNER_URL = `file://${RUNNER}`;
const MODEL_ID = 'gpt-5.6-terra;reasoning=medium;profile=TERRA_MEDIUM';
const PROVIDER_ID = 'OPENAI_CODEX_CLI_SUBSCRIPTION';

function writeExecutable(file, body) {
  fs.writeFileSync(file, body, { mode: 0o755 });
}

test('full runner uses Terra subscription JSONL once, records exact identity, and replays offline', { timeout: 60000 }, async () => {
  const scratch = fs.mkdtempSync(path.join(ROOT, '.terra-runner-fake-'));
  const bin = path.join(scratch, 'bin');
  const liveOut = path.join(scratch, 'live');
  const replayOut = path.join(scratch, 'replay');
  const codexLog = path.join(scratch, 'codex.log');
  const claudeLog = path.join(scratch, 'claude.log');
  const promptLog = path.join(scratch, 'prompt.txt');
  fs.mkdirSync(bin);
  writeExecutable(path.join(bin, 'codex'), `#!/bin/sh
printf '%s\\n' "$*" >> "$FAKE_CODEX_LOG"
if [ -n "$OPENAI_API_KEY$CODEX_API_KEY$CODEX_ACCESS_TOKEN" ]; then exit 91; fi
if [ "$FAKE_CODEX_FAIL_IF_CALLED" = "1" ]; then exit 92; fi
if [ "$1" = "login" ] && [ "$2" = "status" ]; then
  printf '%s\\n' 'Logged in using ChatGPT'
  exit 0
fi
case " $* " in *" exec "*) ;; *) exit 93 ;; esac
case " $* " in *" --json "*) ;; *) exit 93 ;; esac
case " $* " in *" -m gpt-5.6-terra "*) ;; *) exit 93 ;; esac
touch "$FAKE_GIT_DIRTY_MARKER"
cat > "$FAKE_CODEX_PROMPT"
printf '%s\\n' '{"type":"thread.started","thread_id":"terra-thread-1"}'
printf '%s\\n' '{"type":"turn.started"}'
printf '%s\\n' '{"type":"item.completed","item":{"type":"agent_message","text":"{\\"mae_definition_instances\\":[],\\"open_world_candidates\\":[]}"}}'
printf '%s\\n' '{"type":"turn.completed","usage":{"input_tokens":101,"cached_input_tokens":17,"output_tokens":9,"reasoning_output_tokens":3}}'
`);
  writeExecutable(path.join(bin, 'git'), `#!/bin/sh
if [ "$1" = "rev-parse" ] && [ "$2" = "HEAD" ]; then
  printf '%s\\n' 'fake-clean-commit'
  exit 0
fi
if [ "$1" = "status" ] && [ "$2" = "--porcelain" ]; then
  if [ "$FAKE_GIT_INITIAL_DIRTY" = "1" ] || [ -f "$FAKE_GIT_DIRTY_MARKER" ]; then
    printf '%s\\n' '?? evidence/canonical-v2/new-run/'
  fi
  exit 0
fi
exit 95
`);
  writeExecutable(path.join(bin, 'claude'), `#!/bin/sh
printf '%s\\n' "$*" >> "$FAKE_CLAUDE_LOG"
exit 94
`);
  const commonArgs = [
    RUNNER,
    '--deal', 'topbuild',
    '--family', 'MAE_DEFINITION',
    '--section-refs', '3.1(d)(iii)',
    '--no-follow-citations',
  ];
  const env = {
    ...process.env,
    PATH: `${bin}:${process.env.PATH}`,
    FAKE_CODEX_LOG: codexLog,
    FAKE_CLAUDE_LOG: claudeLog,
    FAKE_CODEX_PROMPT: promptLog,
    FAKE_GIT_DIRTY_MARKER: path.join(scratch, 'git-became-dirty'),
    OPENAI_API_KEY: 'must-be-stripped',
    CODEX_API_KEY: 'must-be-stripped',
    CODEX_ACCESS_TOKEN: 'must-be-stripped',
  };
  try {
    const dryReport = JSON.parse(execFileSync('node', [...commonArgs, '--dry-run'], {
      cwd: ROOT, env: { ...env, FAKE_CODEX_FAIL_IF_CALLED: '1' }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    }));
    assert.equal(dryReport.would_call_model, false);
    assert.equal(fs.existsSync(codexLog), false, 'dry-run must not touch Codex');

    const recordingPath = path.join(liveOut, 'recording.json');
    execFileSync('node', [...commonArgs, '--out-dir', liveOut, '--record', recordingPath], {
      cwd: ROOT, env, encoding: 'utf8', stdio: 'pipe',
    });

    const codexCalls = fs.readFileSync(codexLog, 'utf8').trim().split('\n');
    assert.equal(codexCalls.filter((line) => line === 'login status').length, 1);
    assert.equal(codexCalls.filter((line) => line.startsWith('exec ')).length, 1);
    assert.match(codexCalls.find((line) => line.startsWith('exec ')), /--json/);
    assert.equal(fs.existsSync(claudeLog), false, 'Claude must never be invoked');
    assert.match(fs.readFileSync(promptLog, 'utf8'), /You are a JSON extraction engine/);

    const telemetry = JSON.parse(fs.readFileSync(path.join(liveOut, 'call-telemetry.json')));
    assert.equal(telemetry.calls.length, 1);
    assert.equal(telemetry.calls[0].provider_request_id, 'terra-thread-1');
    assert.equal(telemetry.calls[0].requested_model_id, MODEL_ID);
    assert.equal(telemetry.calls[0].requested_model_profile, 'TERRA_MEDIUM');
    assert.equal(telemetry.calls[0].served_model, null);
    assert.equal(telemetry.calls[0].served_model_status, 'NOT_REPORTED_BY_CODEX_JSONL');
    assert.deepEqual(telemetry.calls[0].usage, {
      input_tokens: 101, cached_input_tokens: 17, output_tokens: 9, reasoning_output_tokens: 3,
    });
    const recording = JSON.parse(fs.readFileSync(recordingPath));
    assert.equal(recording.call_count, 1);
    assert.equal(recording.provider_id, PROVIDER_ID);
    assert.equal(recording.provider_model_id, MODEL_ID);
    assert.match(JSON.stringify(recording.calls[0].request_system), /JSON extraction engine/);
    const receipt = JSON.parse(fs.readFileSync(path.join(liveOut, 'run-receipt.json')));
    const sourceSection = receipt.resolved_sections[0];
    assert.equal(sourceSection.producer_receipt.provider_id, PROVIDER_ID);
    assert.equal(sourceSection.producer_receipt.model_id, MODEL_ID);
    assert.equal(sourceSection.prompt_digest, sourceSection.producer_receipt.prompt_digest);
    const runManifest = JSON.parse(fs.readFileSync(path.join(liveOut, 'run-manifest.json')));
    assert.deepEqual(runManifest.requested_models, [MODEL_ID]);
    assert.equal(runManifest.requested_model_id, MODEL_ID);
    assert.deepEqual(runManifest.resolved_models, []);
    assert.deepEqual(runManifest.code_provenance, {
      commit: 'fake-clean-commit',
      working_tree_clean: true,
    }, 'in-repo output writes after startup must not make an initially clean run appear dirty');

    const fixtureName = fs.readdirSync(liveOut).find((name) => name.startsWith('native-producer-recorded-response-'));
    assert.ok(fixtureName);
    const fixtureBytes = fs.readFileSync(path.join(liveOut, fixtureName));
    const receiptBytes = fs.readFileSync(path.join(liveOut, 'run-receipt.json'));
    const runner = await import(RUNNER_URL);
    const manifest = {
      schema_version: 'SEALED_REPLAY_SOURCE_MANIFEST/V1',
      sections: [{
        section_reference: '3.1(d)(iii)',
        source_run_dir: path.relative(ROOT, liveOut),
        fixture_file: fixtureName,
        fixture_sha256: sha256Hex(fixtureBytes),
        run_receipt_file: 'run-receipt.json',
        run_receipt_sha256: sha256Hex(receiptBytes),
        source_call: {
          prompt_digest: sourceSection.prompt_digest,
          producer_receipt_id: sourceSection.producer_receipt.producer_receipt_id,
        },
      }],
    };
    manifest.manifest_id = runner.replaySourceManifestId(manifest);
    const manifestPath = path.join(scratch, 'replay-manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));

    const callsBeforeReplay = fs.readFileSync(codexLog, 'utf8');
    execFileSync('node', [
      ...commonArgs,
      '--out-dir', replayOut,
      '--replay-source-manifest', path.relative(ROOT, manifestPath),
      '--replay-manifest-id', manifest.manifest_id,
    ], {
      cwd: ROOT, env: { ...env, FAKE_CODEX_FAIL_IF_CALLED: '1' }, encoding: 'utf8', stdio: 'pipe',
    });
    assert.equal(fs.readFileSync(codexLog, 'utf8'), callsBeforeReplay, 'sealed replay must not touch Codex');
    assert.equal(JSON.parse(fs.readFileSync(path.join(replayOut, 'run-manifest.json'))).replay.complete, true);

    const badOut = path.join(scratch, 'bad-seal-output');
    assert.throws(() => execFileSync('node', [
      ...commonArgs,
      '--out-dir', badOut,
      '--replay-source-manifest', path.relative(ROOT, manifestPath),
      '--replay-manifest-id', '0'.repeat(64),
    ], { cwd: ROOT, env: { ...env, FAKE_CODEX_FAIL_IF_CALLED: '1' }, stdio: 'pipe' }));
    assert.equal(fs.existsSync(badOut), false, 'bad manifest must fail before output directory creation');

    const initiallyDirtyOut = path.join(scratch, 'initially-dirty');
    const initiallyDirtyRecording = path.join(initiallyDirtyOut, 'recording.json');
    execFileSync('node', [...commonArgs, '--out-dir', initiallyDirtyOut, '--record', initiallyDirtyRecording], {
      cwd: ROOT,
      env: { ...env, FAKE_GIT_INITIAL_DIRTY: '1' },
      encoding: 'utf8',
      stdio: 'pipe',
    });
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(initiallyDirtyOut, 'run-manifest.json'))).code_provenance, {
      commit: 'fake-clean-commit',
      working_tree_clean: false,
    }, 'an initially dirty tree must remain dirty in the run manifest');
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});
