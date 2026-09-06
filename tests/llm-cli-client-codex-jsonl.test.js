'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  createCodexCliClient, codexJsonlResponse, assertCodexChatgptAuth, buildCodexExecArgs,
  receivedCodexOutput,
} = require('../lib/llm-cli-client');

function stream(...events) {
  return `${events.map((event) => JSON.stringify(event)).join('\n')}\n`;
}

const THREAD = { type: 'thread.started', thread_id: 'thread-1' };
const START = { type: 'turn.started' };
const ANSWER = { type: 'item.completed', item: { type: 'agent_message', text: '{}' } };
const COMPLETE = {
  type: 'turn.completed',
  usage: { input_tokens: 1, cached_input_tokens: 0, output_tokens: 1, reasoning_output_tokens: 0 },
};
const RECONNECT_WARNING = {
  type: 'error',
  message: 'Reconnecting... 2/5 (stream disconnected before completion: Incomplete response returned, reason: content_filter)',
};
const HTTPS_FALLBACK_WARNING = {
  type: 'item.completed',
  item: {
    type: 'error',
    message: 'Falling back from WebSockets to HTTPS transport. stream disconnected before completion: Incomplete response returned, reason: content_filter',
  },
};

test('Codex client rejects an invalid retry delay', () => {
  assert.throws(() => createCodexCliClient({ retryDelayMs: -1 }), /non-negative integer/);
});

test('Codex subscription client preflights ChatGPT auth, strips token variables, and parses the JSONL contract', async () => {
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'fake-codex-'));
  const executable = path.join(bin, 'codex');
  fs.writeFileSync(executable, `#!/bin/sh
if [ "$1" = "login" ] && [ "$2" = "status" ]; then
  echo "Logged in using ChatGPT"
  exit 0
fi
if [ -n "$OPENAI_API_KEY$CODEX_API_KEY$CODEX_ACCESS_TOKEN" ]; then
  exit 45
fi
if [ -n "$SUPABASE_SERVICE_ROLE_KEY$PRODUCT_PRIVATE_SECRET" ]; then
  exit 44
fi
case " $* " in
  *" --json "*" -m gpt-5.6-terra "*) ;;
  *) exit 46 ;;
esac
previous=''
for argument in "$@"; do
  if [ "$previous" = "--output-last-message" ]; then final="$argument"; fi
  previous="$argument"
done
cat >/dev/null
printf '%s\n' '{"ok":true}' > "$final"
printf '%s\\n' '{"type":"thread.started","thread_id":"thread-123"}'
printf '%s\\n' '{"type":"turn.started"}'
printf '%s\\n' '{"type":"item.completed","item":{"type":"agent_message","text":"{\\"ok\\":true}"}}'
printf '%s\\n' '{"type":"turn.completed","usage":{"input_tokens":12,"cached_input_tokens":3,"output_tokens":4,"reasoning_output_tokens":5}}'
`, { mode: 0o755 });
  const originalPath = process.env.PATH;
  const originalOpenai = process.env.OPENAI_API_KEY;
  const originalCodex = process.env.CODEX_API_KEY;
  const originalAccess = process.env.CODEX_ACCESS_TOKEN;
  const originalSupabase = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const originalProductSecret = process.env.PRODUCT_PRIVATE_SECRET;
  process.env.PATH = `${bin}:${originalPath}`;
  process.env.OPENAI_API_KEY = 'must-not-reach-child';
  process.env.CODEX_API_KEY = 'must-not-reach-child';
  process.env.CODEX_ACCESS_TOKEN = 'must-not-reach-child';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'must-not-reach-child';
  process.env.PRODUCT_PRIVATE_SECRET = 'must-not-reach-child';
  try {
    const client = createCodexCliClient({
      model: 'gpt-5.6-terra', reasoningEffort: 'medium', maxAttempts: 1, isolated: true,
    });
    const response = await client.messages.create({ messages: [{ role: 'user', content: 'extract' }] });
    assert.equal(response.content[0].text, '{"ok":true}');
    assert.equal(response.codex_thread_id, 'thread-123');
    assert.deepEqual(response.usage, {
      input_tokens: 12, cached_input_tokens: 3, output_tokens: 4, reasoning_output_tokens: 5,
    });
    assert.deepEqual(response.codex_invocation_identity, {
      identity_basis: 'EXPLICIT_CODEX_EXEC_ARGUMENTS', model: 'gpt-5.6-terra', reasoning_effort: 'medium',
      model_argument: ['-m', 'gpt-5.6-terra'], reasoning_argument: ['-c', 'model_reasoning_effort="medium"'],
    });
  } finally {
    process.env.PATH = originalPath;
    if (originalOpenai === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = originalOpenai;
    if (originalCodex === undefined) delete process.env.CODEX_API_KEY; else process.env.CODEX_API_KEY = originalCodex;
    if (originalAccess === undefined) delete process.env.CODEX_ACCESS_TOKEN; else process.env.CODEX_ACCESS_TOKEN = originalAccess;
    if (originalSupabase === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = originalSupabase;
    if (originalProductSecret === undefined) delete process.env.PRODUCT_PRIVATE_SECRET; else process.env.PRODUCT_PRIVATE_SECRET = originalProductSecret;
    fs.rmSync(bin, { recursive: true, force: true });
  }
});

test('isolated Codex calls disable every local, browser and connected tool surface', () => {
  const args = buildCodexExecArgs({
    isolated: true, ignoreUserConfig: true, ignoreRules: true,
    outputLastMessagePath: '/private/tmp/codex-final/message.json',
  });
  for (const feature of [
    'shell_tool', 'unified_exec', 'code_mode_host', 'code_mode', 'code_mode_only', 'tool_suggest', 'goals',
    'apps', 'plugins', 'browser_use', 'in_app_browser',
    'computer_use', 'image_generation', 'multi_agent',
  ]) {
    assert.equal(args.some((value, index) => value === '--disable' && args[index + 1] === feature), true, feature);
  }
  assert.equal(args.includes('tools.web_search=false'), true);
  assert.equal(args.includes('web_search="disabled"'), true);
  assert.equal(args.includes('default_permissions="pm_extraction"'), true);
  assert.equal(args.some((value, index) => value === '--output-last-message'
    && args[index + 1] === '/private/tmp/codex-final/message.json'), true);
  assert.equal(args.some((value) => value.startsWith('permissions={pm_extraction=')
    && value.includes('":minimal"="read"') && value.includes('"/proc"="deny"')
    && value.includes('="deny"')), true);
  assert.equal(args.includes('-s'), false);
  assert.equal(args.includes('--strict-config'), true);
});

test('trusted final-message output selects the last completed agent message from a multi-message turn', () => {
  const commentary = { type: 'item.completed', item: { type: 'agent_message', text: 'Preparing the result.' } };
  const final = { type: 'item.completed', item: { type: 'agent_message', text: '{"ok":true}' } };
  const response = codexJsonlResponse(stream(THREAD, START, commentary, final, COMPLETE), {
    finalMessage: '{"ok":true}\n',
  });
  assert.equal(response.content[0].text, '{"ok":true}');
});

test('known CLI transport progress can precede one independently verified completed answer', () => {
  const commentary = { type: 'item.completed', item: { type: 'agent_message', text: 'Preparing the result.' } };
  const final = { type: 'item.completed', item: { type: 'agent_message', text: '{"ok":true}' } };
  const response = codexJsonlResponse(stream(
    THREAD, START, commentary, RECONNECT_WARNING, HTTPS_FALLBACK_WARNING, final, COMPLETE,
  ), { finalMessage: '{"ok":true}\n' });

  assert.equal(response.content[0].text, '{"ok":true}');
  assert.deepEqual(response.codex_completion.transport_recovery, {
    warning_count: 2,
    warning_types: ['RECONNECT', 'HTTPS_FALLBACK'],
  });
});

for (const [name, warning, warningType] of [
  ['reconnect progress', RECONNECT_WARNING, 'RECONNECT'],
  ['HTTPS fallback progress', HTTPS_FALLBACK_WARNING, 'HTTPS_FALLBACK'],
]) {
  test(`Codex JSONL accepts independently verified output after ${name}`, () => {
    const response = codexJsonlResponse(stream(THREAD, START, warning, ANSWER, COMPLETE), {
      finalMessage: '{}\n',
    });
    assert.deepEqual(response.codex_completion.transport_recovery, {
      warning_count: 1, warning_types: [warningType],
    });
  });
}

for (const [name, raw, finalMessage, pattern] of [
  ['transport progress before turn start', stream(THREAD, RECONNECT_WARNING, START, ANSWER, COMPLETE), '{}', /TRANSPORT_RECOVERY_UNVERIFIED/],
  ['transport progress after the trusted answer', stream(THREAD, START, ANSWER, RECONNECT_WARNING, COMPLETE), '{}', /TRANSPORT_RECOVERY_UNVERIFIED/],
  ['transport progress without output-last-message proof', stream(THREAD, START, RECONNECT_WARNING, ANSWER, COMPLETE), undefined, /TRANSPORT_RECOVERY_UNVERIFIED/],
  ['an unknown top-level error despite trusted output', stream(THREAD, START, { type: 'error', message: 'provider failed' }, ANSWER, COMPLETE), '{}', /TURN_FAILED/],
  ['an altered reconnect reason despite trusted output', stream(THREAD, START, { type: 'error', message: 'Reconnecting... 2/5 (stream disconnected before completion: refusal)' }, ANSWER, COMPLETE), '{}', /TURN_FAILED/],
  ['an altered fallback error despite trusted output', stream(THREAD, START, { type: 'item.completed', item: { type: 'error', message: 'Falling back after refusal' } }, ANSWER, COMPLETE), '{}', /TURN_FAILED/],
  ['recognised reconnect progress carrying a forbidden tool item', stream(THREAD, START, { ...RECONNECT_WARNING, item: { type: 'command_execution', command: 'pwd' } }, ANSWER, COMPLETE), '{}', /TOOL_FORBIDDEN/],
  ['recognised reconnect progress carrying any top-level item', stream(THREAD, START, { ...RECONNECT_WARNING, item: { type: 'reasoning', text: 'x' } }, ANSWER, COMPLETE), '{}', /TURN_FAILED/],
]) {
  test(`Codex JSONL rejects ${name}`, () => {
    assert.throws(() => codexJsonlResponse(raw, { finalMessage }), pattern);
  });
}

for (const [name, raw, finalMessage, pattern] of [
  ['empty trusted final output', stream(THREAD, START, ANSWER, COMPLETE), ' ', /FINAL_MESSAGE_REQUIRED/],
  ['mismatched trusted final output', stream(THREAD, START, ANSWER, COMPLETE), '{"wrong":true}', /FINAL_MESSAGE_MISMATCH/],
  ['ambiguous trusted final output', stream(THREAD, START, ANSWER, ANSWER, COMPLETE), '{}', /FINAL_MESSAGE_AMBIGUOUS/],
  ['an early message even when the last message is valid', stream(THREAD, ANSWER, START, ANSWER, COMPLETE), '{}', /LIFECYCLE_ORDER/],
  ['a failed turn before trusted output', stream(THREAD, START, { type: 'turn.failed', error: 'x' }, ANSWER, COMPLETE), '{}', /TURN_FAILED/],
  ['an error item before trusted output', stream(THREAD, START, { type: 'item.completed', item: { type: 'error', message: 'provider failed' } }, ANSWER, COMPLETE), '{}', /TURN_FAILED:.*provider failed/],
  ['a model-generated command before trusted output', stream(THREAD, START, { type: 'item.completed', item: { type: 'command_execution', command: 'pwd' } }, ANSWER, COMPLETE), '{}', /TOOL_FORBIDDEN/],
  ['malformed usage after trusted output', stream(THREAD, START, ANSWER, { ...COMPLETE, usage: {} }), '{}', /USAGE_REQUIRED/],
]) {
  test(`Codex JSONL rejects ${name}`, () => {
    assert.throws(() => codexJsonlResponse(raw, { finalMessage }), pattern);
  });
}

test('Codex client uses one private final-message file and removes it after capture', async () => {
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'fake-codex-final-'));
  const executable = path.join(bin, 'codex');
  const capture = path.join(bin, 'capture.txt');
  fs.writeFileSync(executable, `#!/bin/sh
final=''
while [ "$#" -gt 0 ]; do
  if [ "$1" = "--output-last-message" ]; then shift; final="$1"; fi
  shift
done
cat >/dev/null
printf '%s\n' '{"ok":true}' > "$final"
printf '%s\n' "$final" > ${JSON.stringify(capture)}
stat -f '%Lp' "$(dirname "$final")" >> ${JSON.stringify(capture)}
printf '%s\n' '{"type":"thread.started","thread_id":"thread-final"}'
printf '%s\n' '{"type":"turn.started"}'
printf '%s\n' '{"type":"item.completed","item":{"type":"agent_message","text":"Working."}}'
printf '%s\n' '{"type":"error","message":"Reconnecting... 2/5 (stream disconnected before completion: Incomplete response returned, reason: content_filter)"}'
printf '%s\n' '{"type":"item.completed","item":{"type":"error","message":"Falling back from WebSockets to HTTPS transport. stream disconnected before completion: Incomplete response returned, reason: content_filter"}}'
printf '%s\n' '{"type":"item.completed","item":{"type":"agent_message","text":"{\\"ok\\":true}"}}'
printf '%s\n' '{"type":"turn.completed","usage":{"input_tokens":2,"cached_input_tokens":0,"output_tokens":1,"reasoning_output_tokens":0}}'
`, { mode: 0o755 });
  const originalPath = process.env.PATH;
  process.env.PATH = `${bin}:${originalPath}`;
  try {
    const client = createCodexCliClient({ isolated: true, skipAuthPreflight: true, maxAttempts: 1 });
    const response = await client.messages.create({ messages: [{ role: 'user', content: 'extract' }] });
    const [finalPath, mode] = fs.readFileSync(capture, 'utf8').trim().split('\n');
    assert.equal(response.content[0].text, '{"ok":true}');
    assert.deepEqual(response.codex_completion.transport_recovery, {
      warning_count: 2, warning_types: ['RECONNECT', 'HTTPS_FALLBACK'],
    });
    assert.equal(mode, '700');
    assert.equal(fs.existsSync(path.dirname(finalPath)), false);
  } finally {
    process.env.PATH = originalPath;
    fs.rmSync(bin, { recursive: true, force: true });
  }
});

test('Codex client rejects a completed stream when the trusted final-message file is missing', async () => {
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'fake-codex-missing-final-'));
  const executable = path.join(bin, 'codex');
  fs.writeFileSync(executable, `#!/bin/sh
cat >/dev/null
printf '%s\n' '{"type":"thread.started","thread_id":"thread-missing-final"}'
printf '%s\n' '{"type":"turn.started"}'
printf '%s\n' '{"type":"item.completed","item":{"type":"agent_message","text":"{}"}}'
printf '%s\n' '{"type":"turn.completed","usage":{"input_tokens":1,"cached_input_tokens":0,"output_tokens":1,"reasoning_output_tokens":0}}'
`, { mode: 0o755 });
  const originalPath = process.env.PATH;
  process.env.PATH = `${bin}:${originalPath}`;
  try {
    const client = createCodexCliClient({ isolated: true, skipAuthPreflight: true, maxAttempts: 1 });
    await assert.rejects(
      () => client.messages.create({ messages: [{ role: 'user', content: 'extract' }] }),
      /CODEX_FINAL_MESSAGE_REQUIRED/,
    );
  } finally {
    process.env.PATH = originalPath;
    fs.rmSync(bin, { recursive: true, force: true });
  }
});

test('Codex client cannot reuse a stale final-message file on an internal retry', async () => {
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'fake-codex-stale-final-'));
  const executable = path.join(bin, 'codex');
  const counter = path.join(bin, 'counter.txt');
  fs.writeFileSync(executable, `#!/bin/sh
final=''
previous=''
for argument in "$@"; do
  if [ "$previous" = "--output-last-message" ]; then final="$argument"; fi
  previous="$argument"
done
cat >/dev/null
count=0
if [ -f ${JSON.stringify(counter)} ]; then count=$(cat ${JSON.stringify(counter)}); fi
count=$((count + 1))
printf '%s' "$count" > ${JSON.stringify(counter)}
if [ "$count" -eq 1 ]; then printf '%s\n' '{}' > "$final"; fi
printf '%s\n' '{"type":"thread.started","thread_id":"thread-stale-final"}'
printf '%s\n' '{"type":"turn.started"}'
printf '%s\n' '{"type":"item.completed","item":{"type":"agent_message","text":"{}"}}'
printf '%s\n' '{"type":"turn.completed","usage":{"input_tokens":1,"cached_input_tokens":0,"output_tokens":1,"reasoning_output_tokens":0}}'
if [ "$count" -eq 1 ]; then exit 7; fi
`, { mode: 0o755 });
  const originalPath = process.env.PATH;
  process.env.PATH = `${bin}:${originalPath}`;
  try {
    const client = createCodexCliClient({
      isolated: true, skipAuthPreflight: true, maxAttempts: 2, retryDelayMs: 1,
    });
    await assert.rejects(
      () => client.messages.create({ messages: [{ role: 'user', content: 'extract' }] }),
      (error) => {
        assert.match(error.message, /CODEX_FINAL_MESSAGE_REQUIRED/);
        assert.equal(receivedCodexOutput(error)?.finalMessage, undefined);
        return true;
      },
    );
    assert.equal(fs.readFileSync(counter, 'utf8'), '2');
  } finally {
    process.env.PATH = originalPath;
    fs.rmSync(bin, { recursive: true, force: true });
  }
});

test('ChatGPT auth preflight rejects a negated status line even with exit zero', async () => {
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'fake-codex-negated-auth-'));
  const executable = path.join(bin, 'codex');
  fs.writeFileSync(executable, '#!/bin/sh\necho "Not logged in using ChatGPT"\nexit 0\n', { mode: 0o755 });
  const originalPath = process.env.PATH;
  process.env.PATH = `${bin}:${originalPath}`;
  try {
    await assert.rejects(() => assertCodexChatgptAuth(), /CODEX_CHATGPT_AUTH_REQUIRED/);
  } finally {
    process.env.PATH = originalPath;
    fs.rmSync(bin, { recursive: true, force: true });
  }
});

test('ChatGPT auth preflight accepts a code-zero child that closes stdin before empty input', async () => {
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'fake-codex-empty-stdin-'));
  const executable = path.join(bin, 'codex');
  fs.symlinkSync('/bin/sh', executable);
  fs.writeFileSync(
    path.join(bin, 'login'),
    'exec 0<&-\nsleep 0.005\nprintf "Logged in using ChatGPT\\n"\n',
  );
  const originalPath = process.env.PATH;
  const originalCwd = process.cwd();
  process.env.PATH = `${bin}:${originalPath}`;
  process.chdir(bin);
  try {
    const statuses = await Promise.all(Array.from({ length: 500 }, () => assertCodexChatgptAuth()));
    assert.deepEqual(statuses, Array(500).fill('Logged in using ChatGPT'));
  } finally {
    process.chdir(originalCwd);
    process.env.PATH = originalPath;
    fs.rmSync(bin, { recursive: true, force: true });
  }
});

test('Codex subscription client reports an early child exit without an uncaught stdin EPIPE', async () => {
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'fake-codex-closed-stdin-'));
  const executable = path.join(bin, 'codex');
  fs.writeFileSync(executable, '#!/bin/sh\nexec 0<&-\nsleep 0.05\nexit 47\n', { mode: 0o755 });
  const originalPath = process.env.PATH;
  process.env.PATH = `${bin}:${originalPath}`;
  try {
    const client = createCodexCliClient({
      model: 'gpt-5.6-terra', reasoningEffort: 'medium', maxAttempts: 1, skipAuthPreflight: true,
    });
    await assert.rejects(
      () => client.messages.create({ messages: [{ role: 'user', content: 'x'.repeat(1024 * 1024) }] }),
      /codex exited 47/,
    );
  } finally {
    process.env.PATH = originalPath;
    fs.rmSync(bin, { recursive: true, force: true });
  }
});

for (const [name, raw, pattern] of [
  ['empty stream', '', /CODEX_JSONL_EMPTY/],
  ['missing usage', stream(THREAD, START, ANSWER, { type: 'turn.completed' }), /USAGE_REQUIRED/],
  ['empty usage', stream(THREAD, START, ANSWER, { type: 'turn.completed', usage: {} }), /USAGE_REQUIRED/],
  ['failed turn before apparent success', stream(THREAD, START, { type: 'turn.failed', error: 'x' }, ANSWER, COMPLETE), /TURN_FAILED/],
  ['model-generated command', stream(THREAD, START, { type: 'item.completed', item: { type: 'command_execution', command: 'pwd' } }, ANSWER, COMPLETE), /TOOL_FORBIDDEN/],
  ['duplicate completed turns', stream(THREAD, START, ANSWER, COMPLETE, COMPLETE), /COMPLETION_COUNT/],
  ['duplicate agent answers', stream(THREAD, START, ANSWER, ANSWER, COMPLETE), /ANSWER_COUNT/],
  ['unknown terminal shape', stream(THREAD, START, ANSWER, { type: 'turn.cancelled' }), /TERMINAL_UNKNOWN/],
  ['malformed completed item', stream(THREAD, START, { type: 'item.completed' }, COMPLETE), /ITEM_COMPLETION_MALFORMED/],
  ['event after completion', stream(THREAD, START, ANSWER, COMPLETE, { type: 'item.started', item: { type: 'reasoning' } }), /TERMINAL_ORDER/],
  ['duplicate thread starts', stream(THREAD, THREAD, START, ANSWER, COMPLETE), /THREAD_REQUIRED/],
  ['duplicate turn starts', stream(THREAD, START, START, ANSWER, COMPLETE), /TURN_START_REQUIRED/],
  ['blank thread identity', stream({ type: 'thread.started', thread_id: ' ' }, START, ANSWER, COMPLETE), /THREAD_REQUIRED/],
  ['blank lifecycle event type', stream(THREAD, { type: ' ' }, START, ANSWER, COMPLETE), /EVENT_MALFORMED/],
  ['blank agent answer', stream(THREAD, START, { type: 'item.completed', item: { type: 'agent_message', text: ' ' } }, COMPLETE), /ANSWER_REQUIRED/],
  ['completion before turn start', stream(THREAD, ANSWER, START, COMPLETE), /LIFECYCLE_ORDER/],
  ['fractional usage', stream(THREAD, START, ANSWER, { ...COMPLETE, usage: { ...COMPLETE.usage, output_tokens: 1.5 } }), /USAGE_INVALID/],
  ['negative usage', stream(THREAD, START, ANSWER, { ...COMPLETE, usage: { ...COMPLETE.usage, output_tokens: -1 } }), /USAGE_INVALID/],
  ['non-finite usage', stream(THREAD, START, ANSWER, COMPLETE).replace('"output_tokens":1', '"output_tokens":1e999'), /USAGE_INVALID/],
]) {
  test(`Codex JSONL rejects ${name}`, () => {
    assert.throws(() => codexJsonlResponse(raw), pattern);
  });
}
