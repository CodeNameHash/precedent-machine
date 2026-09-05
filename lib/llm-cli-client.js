/* ─────────────────────────────────────────────────────────────────────────
   lib/llm-cli-client.js — subscription-powered LLM backends for the pipeline.
   ───────────────────────────────────────────────────────────────────────────
   Drop-in replacements for the Anthropic SDK client used by parser-v2. The
   whole pipeline calls `client.messages.create({model, max_tokens, messages})`
   and reads `resp.content.map(c => c.text)` — nothing else (no streaming, no
   usage, no system param). So a CLI-backed object with that one method makes
   every extraction runnable on flat-rate subscriptions instead of metered API
   tokens:

     createClaudeCliClient()  → `claude -p` subprocess  (Claude Max plan)
     createCodexCliClient()   → `codex exec` subprocess (ChatGPT plan)

   Used by the local runner scripts (scripts/*). Never used from Vercel — the
   CLIs only exist on the local machine.

   CRITICAL: ANTHROPIC_API_KEY is stripped from the child env. If it leaks in,
   `claude -p` silently prefers API-key billing over subscription auth and the
   zero-token goal is defeated.
   ───────────────────────────────────────────────────────────────────────── */

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000; // extraction prompts can run long
const MAX_CONCURRENT = 2; // be kind to subscription rate windows

// Tiny semaphore so a burst of pipeline calls doesn't fork 20 CLI processes.
let active = 0;
const waiters = [];
async function acquire() {
  if (active < MAX_CONCURRENT) { active += 1; return; }
  await new Promise((resolve) => waiters.push(resolve));
  active += 1;
}
function release() {
  active -= 1;
  const next = waiters.shift();
  if (next) next();
}

const ISOLATED_CODEX_ENV_KEYS = Object.freeze([
  'PATH', 'HOME', 'CODEX_HOME', 'USER', 'LOGNAME', 'SHELL', 'TMPDIR', 'TERM',
  'LANG', 'LC_ALL', 'SSL_CERT_FILE', 'SSL_CERT_DIR', 'CODEX_CA_CERTIFICATE',
]);

function childEnv(isolated = false) {
  if (isolated) {
    return Object.fromEntries(ISOLATED_CODEX_ENV_KEYS
      .filter((key) => process.env[key] !== undefined)
      .map((key) => [key, process.env[key]]));
  }
  const env = { ...process.env };
  // A saved ChatGPT subscription session is the only accepted credential for
  // this backend. These variables make Codex choose metered/token auth.
  delete env.ANTHROPIC_API_KEY;
  delete env.OPENAI_API_KEY;
  delete env.CODEX_API_KEY;
  delete env.CODEX_ACCESS_TOKEN;
  return env;
}

async function assertCodexChatgptAuth(timeoutMs = DEFAULT_TIMEOUT_MS, isolated = false) {
  let status;
  try {
    status = (await runProcess('codex', ['login', 'status'], '', timeoutMs, true, isolated)).trim();
  } catch (error) {
    throw new Error(
      'CODEX_CHATGPT_AUTH_REQUIRED: codex login status must report ChatGPT authentication. '
      + `Received: ${String(error && error.message ? error.message : error).slice(0, 300)}`,
    );
  }
  if (status !== 'Logged in using ChatGPT') {
    throw new Error(
      'CODEX_CHATGPT_AUTH_REQUIRED: codex login status must report ChatGPT authentication. '
      + `Received: ${status.slice(0, 300) || 'no status output'}`,
    );
  }
  return status;
}

function runProcess(cmd, args, stdinText, timeoutMs, includeStderrOnSuccess = false, isolated = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { env: childEnv(isolated), stdio: ['pipe', 'pipe', 'pipe'] });
    const hasStdinPayload = stdinText !== '';
    let out = '';
    let err = '';
    let stdinError = null;
    let settled = false;
    const settle = (callback) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback();
    };
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      settle(() => reject(new Error(`${cmd} timed out after ${timeoutMs}ms`)));
    }, timeoutMs);
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.stdin.on('error', (error) => { stdinError ||= error; });
    child.on('error', (error) => { settle(() => reject(error)); });
    child.on('close', (code) => {
      settle(() => {
        if (code !== 0) return reject(new Error(`${cmd} exited ${code}: ${err.slice(0, 500)}`));
        if (stdinError && (hasStdinPayload || stdinError.code !== 'EPIPE')) {
          return reject(new Error(`${cmd} stdin failed: ${stdinError.message}`));
        }
        resolve(includeStderrOnSuccess ? `${out}\n${err}` : out);
      });
    });
    if (hasStdinPayload) child.stdin.end(stdinText);
    else child.stdin.end();
  });
}

// Flatten an Anthropic messages array into one prompt string. The pipeline
// only ever sends a single user message, but handle the general case.
function flattenMessages(params) {
  const parts = [];
  if (params.system) {
    const sys = Array.isArray(params.system)
      ? params.system.map((b) => (typeof b === 'string' ? b : b.text || '')).join('\n')
      : String(params.system);
    if (sys.trim()) parts.push(sys);
  }
  for (const m of params.messages || []) {
    const content = typeof m.content === 'string'
      ? m.content
      : (m.content || []).map((b) => b.text || '').join('\n');
    parts.push(content);
  }
  return parts.join('\n\n');
}

function anthropicShaped(text, extras = {}) {
  return { content: [{ type: 'text', text }], stop_reason: 'end_turn', ...extras };
}

// Every pipeline call to these backends expects the model to answer with JSON
// only. `claude -p` (reasoning-style) otherwise trails the JSON with commentary
// ("None of the nine TERMR codes fit, so I flagged it..."), which breaks the
// parser and silently drops the chunk. The prose-tolerant parser recovers most
// of these, but suppressing the prose at the source is cheaper and more robust.
const JSON_ONLY_INSTRUCTION =
  'You are a JSON extraction engine. Output ONLY the requested valid JSON. '
  + 'Do not use tools or inspect files. Use only the source text in the request. '
  + 'No explanation, no commentary, no markdown fences, no reasoning — JSON only.';

/**
 * `claude -p` backend (Claude Max subscription).
 * opts.model: CLI model alias/id override (default: 'sonnet'). The pipeline's
 * params.model (an API id) is ignored in favour of this — subscription plans
 * address models by alias.
 */
function createClaudeCliClient(opts = {}) {
  const model = opts.model || 'sonnet';
  const timeoutMs = opts.timeoutMs || DEFAULT_TIMEOUT_MS;
  return {
    backend: 'claude-cli',
    model,
    messages: {
      create: async (params) => {
        const prompt = flattenMessages(params);
        await acquire();
        try {
          // --output-format json → single JSON object with a `result` field.
          // One retry on transient failure (rate window, parse hiccup).
          for (let attempt = 1; ; attempt++) {
            try {
              const raw = await runProcess(
                'claude',
                [
                  '-p',
                  '--output-format', 'json',
                  '--model', model,
                  // Force JSON-only output — suppress reasoning prose at source.
                  '--append-system-prompt', JSON_ONLY_INSTRUCTION,
                ],
                prompt,
                timeoutMs,
              );
              const parsed = JSON.parse(raw);
              if (parsed.is_error) throw new Error(`claude -p error: ${String(parsed.result).slice(0, 300)}`);
              return anthropicShaped(parsed.result || '');
            } catch (e) {
              if (attempt >= 2) throw e;
              await new Promise((r) => setTimeout(r, 15000));
            }
          }
        } finally {
          release();
        }
      },
    },
  };
}

/**
 * `codex exec` backend (ChatGPT plan). Read-only sandbox — the model just
 * answers the prompt; it neither needs nor gets file/exec access.
 */
function buildCodexExecArgs(opts = {}) {
  if (opts.reasoningEffort !== undefined
    && !/^[a-z][a-z0-9_-]*$/i.test(opts.reasoningEffort)) {
    throw new TypeError('reasoningEffort must be a simple non-empty identifier');
  }
  const workingDirectory = opts.workingDirectory || os.tmpdir();
  const authDirectory = process.env.CODEX_HOME || path.join(process.env.HOME || os.homedir(), '.codex');
  return [
    'exec',
    '--json',
    ...(opts.isolated ? [] : ['-s', 'read-only']),
    '--color', 'never',
    ...(opts.model ? ['-m', opts.model] : []),
    ...(opts.reasoningEffort
      ? ['-c', `model_reasoning_effort="${opts.reasoningEffort}"`]
      : []),
    ...(opts.ephemeral ? ['--ephemeral'] : []),
    ...(opts.ignoreUserConfig ? ['--ignore-user-config'] : []),
    ...(opts.ignoreRules ? ['--ignore-rules'] : []),
    ...(opts.isolated ? [
      '--strict-config',
      '-c', 'default_permissions="pm_extraction"',
      '-c', `permissions={pm_extraction={filesystem={":minimal"="read",${JSON.stringify(workingDirectory)}="read",${JSON.stringify(authDirectory)}="deny","/proc"="deny"},network={enabled=false}}}`,
      '--disable', 'shell_tool',
      '--disable', 'unified_exec',
      '--disable', 'code_mode_host',
      '--disable', 'code_mode',
      '--disable', 'code_mode_only',
      '--disable', 'tool_suggest',
      '--disable', 'goals',
      '--disable', 'apps',
      '--disable', 'plugins',
      '--disable', 'browser_use',
      '--disable', 'in_app_browser',
      '--disable', 'computer_use',
      '--disable', 'image_generation',
      '--disable', 'multi_agent',
      '-c', 'tools.web_search=false',
      '-c', 'web_search="disabled"',
    ] : []),
    ...(opts.isolated ? ['--skip-git-repo-check', '-C', workingDirectory] : []),
    '-',
  ];
}

function codexInvocationIdentity(opts = {}) {
  return Object.freeze({
    identity_basis: 'EXPLICIT_CODEX_EXEC_ARGUMENTS',
    model: opts.model || null,
    reasoning_effort: opts.reasoningEffort || null,
    model_argument: opts.model ? Object.freeze(['-m', opts.model]) : null,
    reasoning_argument: opts.reasoningEffort
      ? Object.freeze(['-c', `model_reasoning_effort="${opts.reasoningEffort}"`]) : null,
  });
}

function createCodexCliClient(opts = {}) {
  const timeoutMs = opts.timeoutMs || DEFAULT_TIMEOUT_MS;
  const maxAttempts = opts.maxAttempts === undefined ? 2 : opts.maxAttempts;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new TypeError('maxAttempts must be a positive integer');
  }
  const invocationIdentity = codexInvocationIdentity(opts);
  let authPreflight = null;
  return {
    backend: 'codex-cli',
    model: opts.model || 'gpt-default',
    reasoningEffort: opts.reasoningEffort || null,
    messages: {
      create: async (params) => {
        if (opts.skipAuthPreflight !== true) {
          if (!authPreflight) authPreflight = assertCodexChatgptAuth(timeoutMs, opts.isolated === true);
          await authPreflight;
        }
        const prompt = flattenMessages(params);
        const workingDirectory = opts.isolated ? fs.mkdtempSync(path.join(os.tmpdir(), 'codex-product-')) : null;
        await acquire();
        try {
          const execArgs = buildCodexExecArgs({ ...opts, workingDirectory });
          for (let attempt = 1; ; attempt++) {
            try {
              const raw = await runProcess(
                'codex',
                execArgs,
                prompt,
                timeoutMs,
                false,
                opts.isolated === true,
              );
              const response = codexJsonlResponse(raw);
              return Object.freeze({ ...response, codex_invocation_identity: invocationIdentity });
            } catch (e) {
              if (attempt >= maxAttempts) throw e;
              await new Promise((r) => setTimeout(r, 15000));
            }
          }
        } finally {
          release();
          if (workingDirectory) fs.rmSync(workingDirectory, { recursive: true, force: true });
        }
      },
    },
  };
}

function codexJsonlResponse(raw) {
  const events = [];
  for (const [index, line] of raw.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line));
    } catch {
      throw new Error(`CODEX_JSONL_MALFORMED: line ${index + 1} is not JSON`);
    }
  }
  if (events.length === 0) throw new Error('CODEX_JSONL_EMPTY: codex exec emitted no JSONL events');
  for (const [index, event] of events.entries()) {
    if (!event || typeof event !== 'object' || Array.isArray(event)
      || typeof event.type !== 'string' || event.type.trim() === '') {
      throw new Error(`CODEX_JSONL_EVENT_MALFORMED: event ${index + 1} needs an object type`);
    }
    if (event.type === 'error' || event.type.endsWith('.failed')) {
      throw new Error(`CODEX_JSONL_TURN_FAILED: ${JSON.stringify(event).slice(0, 500)}`);
    }
    if (event.type.startsWith('turn.') && !['turn.started', 'turn.completed'].includes(event.type)) {
      throw new Error(`CODEX_JSONL_TERMINAL_UNKNOWN: unsupported turn event ${event.type}`);
    }
    if (event.type.endsWith('.completed') && !['item.completed', 'turn.completed'].includes(event.type)) {
      throw new Error(`CODEX_JSONL_TERMINAL_UNKNOWN: unsupported completed event ${event.type}`);
    }
    if (event.type === 'item.completed' && (!event.item || typeof event.item !== 'object' || Array.isArray(event.item)
      || typeof event.item.type !== 'string')) {
      throw new Error(`CODEX_JSONL_ITEM_COMPLETION_MALFORMED: event ${index + 1}`);
    }
    if (event.item && !['agent_message', 'reasoning'].includes(event.item.type)) {
      throw new Error(`CODEX_JSONL_TOOL_FORBIDDEN: item ${index + 1} has type ${event.item.type}`);
    }
  }
  const threadEvents = events.filter((event) => event.type === 'thread.started');
  if (threadEvents.length !== 1 || events[0] !== threadEvents[0]
    || typeof threadEvents[0].thread_id !== 'string' || threadEvents[0].thread_id.trim() === '') {
    throw new Error(
      `CODEX_JSONL_THREAD_REQUIRED: expected one valid thread.started as the first event, got ${threadEvents.length}`,
    );
  }
  const turnStarts = events.filter((event) => event.type === 'turn.started');
  if (turnStarts.length !== 1 || events.indexOf(turnStarts[0]) <= 0) {
    throw new Error(`CODEX_JSONL_TURN_START_REQUIRED: expected one turn.started after thread.started, got ${turnStarts.length}`);
  }
  const answers = events.filter((event) => event.type === 'item.completed'
    && event.item && event.item.type === 'agent_message' && typeof event.item.text === 'string');
  if (answers.length !== 1) {
    throw new Error(`CODEX_JSONL_ANSWER_COUNT: expected one completed agent_message, got ${answers.length}`);
  }
  if (events.indexOf(answers[0]) <= events.indexOf(turnStarts[0])) {
    throw new Error('CODEX_JSONL_LIFECYCLE_ORDER: agent answer must follow turn.started');
  }
  const text = answers[0].item.text.trim();
  if (!text) throw new Error('CODEX_JSONL_ANSWER_REQUIRED: completed agent_message text is empty');
  const turns = events.filter((event) => event.type === 'turn.completed');
  if (turns.length !== 1) {
    throw new Error(`CODEX_JSONL_COMPLETION_COUNT: expected one turn.completed event, got ${turns.length}`);
  }
  if (events.at(-1) !== turns[0]) throw new Error('CODEX_JSONL_TERMINAL_ORDER: turn.completed must be the final event');
  const usage = turns[0].usage;
  if (!usage || typeof usage !== 'object' || Array.isArray(usage) || Object.keys(usage).length === 0) {
    throw new Error('CODEX_JSONL_USAGE_REQUIRED: turn.completed needs a non-empty usage object');
  }
  const requiredUsage = ['input_tokens', 'cached_input_tokens', 'output_tokens', 'reasoning_output_tokens'];
  for (const key of requiredUsage) {
    const value = usage[key];
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`CODEX_JSONL_USAGE_INVALID: usage.${key} must be a non-negative integer`);
    }
  }
  return anthropicShaped(text, {
    usage,
    provider_request_id: threadEvents[0].thread_id,
    codex_thread_id: threadEvents[0].thread_id,
    codex_completion: Object.freeze({ status: 'COMPLETE', terminal_event: 'turn.completed' }),
  });
}

function withPromptPrefixClient({ client, prefix = JSON_ONLY_INSTRUCTION }) {
  if (!client || !client.messages || typeof client.messages.create !== 'function') {
    throw new TypeError('PROMPT_PREFIX_CLIENT_REQUIRES_CLIENT: pass a client with messages.create');
  }
  if (typeof prefix !== 'string' || prefix.trim() === '') {
    throw new TypeError('PROMPT_PREFIX_CLIENT_REQUIRES_PREFIX: prefix must be a non-empty string');
  }
  return {
    messages: {
      create(params) {
        const existing = params && params.system;
        const system = [{ type: 'text', text: prefix }]
          .concat(existing === undefined ? [] : (Array.isArray(existing) ? existing : [existing]));
        return client.messages.create({ ...params, system });
      },
    },
  };
}

module.exports = {
  ISOLATED_CODEX_ENV_KEYS,
  createClaudeCliClient,
  createCodexCliClient,
  codexInvocationIdentity,
  buildCodexExecArgs,
  assertCodexChatgptAuth,
  codexJsonlResponse,
  withPromptPrefixClient,
  JSON_ONLY_INSTRUCTION,
};
