'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  createCodexCliClient, codexJsonlResponse, assertCodexChatgptAuth,
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
case " $* " in
  *" --json "*" -m gpt-5.6-terra "*) ;;
  *) exit 46 ;;
esac
cat >/dev/null
printf '%s\\n' '{"type":"thread.started","thread_id":"thread-123"}'
printf '%s\\n' '{"type":"turn.started"}'
printf '%s\\n' '{"type":"item.completed","item":{"type":"agent_message","text":"{\\"ok\\":true}"}}'
printf '%s\\n' '{"type":"turn.completed","usage":{"input_tokens":12,"cached_input_tokens":3,"output_tokens":4,"reasoning_output_tokens":5}}'
`, { mode: 0o755 });
  const originalPath = process.env.PATH;
  const originalOpenai = process.env.OPENAI_API_KEY;
  const originalCodex = process.env.CODEX_API_KEY;
  const originalAccess = process.env.CODEX_ACCESS_TOKEN;
  process.env.PATH = `${bin}:${originalPath}`;
  process.env.OPENAI_API_KEY = 'must-not-reach-child';
  process.env.CODEX_API_KEY = 'must-not-reach-child';
  process.env.CODEX_ACCESS_TOKEN = 'must-not-reach-child';
  try {
    const client = createCodexCliClient({ model: 'gpt-5.6-terra', maxAttempts: 1 });
    const response = await client.messages.create({ messages: [{ role: 'user', content: 'extract' }] });
    assert.equal(response.content[0].text, '{"ok":true}');
    assert.equal(response.codex_thread_id, 'thread-123');
    assert.deepEqual(response.usage, {
      input_tokens: 12, cached_input_tokens: 3, output_tokens: 4, reasoning_output_tokens: 5,
    });
  } finally {
    process.env.PATH = originalPath;
    if (originalOpenai === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = originalOpenai;
    if (originalCodex === undefined) delete process.env.CODEX_API_KEY; else process.env.CODEX_API_KEY = originalCodex;
    if (originalAccess === undefined) delete process.env.CODEX_ACCESS_TOKEN; else process.env.CODEX_ACCESS_TOKEN = originalAccess;
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

for (const [name, raw, pattern] of [
  ['empty stream', '', /CODEX_JSONL_EMPTY/],
  ['missing usage', stream(THREAD, START, ANSWER, { type: 'turn.completed' }), /USAGE_REQUIRED/],
  ['empty usage', stream(THREAD, START, ANSWER, { type: 'turn.completed', usage: {} }), /USAGE_REQUIRED/],
  ['failed turn before apparent success', stream(THREAD, START, { type: 'turn.failed', error: 'x' }, ANSWER, COMPLETE), /TURN_FAILED/],
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
