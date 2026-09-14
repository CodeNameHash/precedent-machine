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
const RECEIVED_CODEX_OUTPUT = Symbol('receivedCodexOutput');
const RECEIVED_PROCESS_STDOUT = Symbol('receivedProcessStdout');

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

function lastStdoutErrorMessage(out) {
  let message = '';
  for (const line of String(out || '').split('\n')) {
    try {
      const event = JSON.parse(line);
      const candidate = event?.type === 'error' ? event.message
        : event?.type === 'turn.failed' ? event.error?.message
          : event?.type === 'item.completed' && event.item?.type === 'error' ? event.item.message : null;
      if (typeof candidate === 'string' && candidate.trim()) message = candidate.trim();
    } catch {}
  }
  return message.slice(0, 500);
}

const USAGE_LIMIT = /usage limit|purchase more credits|rate limit|limit reached|out of extra usage/i;
function isUsageLimitError(error) {
  return USAGE_LIMIT.test(String(error?.message || ''));
}

function runProcess(cmd, args, stdinText, timeoutMs, includeStderrOnSuccess = false, isolated = false, options = {}) {
  return new Promise((resolve, reject) => {
    const env = options.env || childEnv(isolated);
    const child = spawn(cmd, args, { env, stdio: ['pipe', 'pipe', 'pipe'], ...(options.cwd ? { cwd: options.cwd } : {}) });
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
    const failure = (error) => {
      if (out !== '') {
        Object.defineProperty(error, RECEIVED_PROCESS_STDOUT, {
          configurable: false,
          enumerable: false,
          writable: false,
          value: out,
        });
      }
      return error;
    };
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      settle(() => reject(failure(new Error(`${cmd} timed out after ${timeoutMs}ms`))));
    }, timeoutMs);
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.stdin.on('error', (error) => { stdinError ||= error; });
    child.on('error', (error) => { settle(() => reject(failure(error))); });
    child.on('close', (code) => {
      settle(() => {
        if (code !== 0) {
          // A non-zero exit with nothing on stderr: the reason is usually the
          // last JSON error event on stdout (Codex 0.147 on a ChatGPT login,
          // "You've hit your usage limit", Metsera generation 5 at 04:59 UTC,
          // 2026-09-14: three attempts in three seconds recorded as
          // "codex exited 1: " and the run FAILED with no reason).
          const detail = err.trim() ? err.slice(0, 500) : lastStdoutErrorMessage(out);
          return reject(failure(new Error(`${cmd} exited ${code}: ${detail}`)));
        }
        if (stdinError && (hasStdinPayload || stdinError.code !== 'EPIPE')) {
          return reject(failure(new Error(`${cmd} stdin failed: ${stdinError.message}`)));
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

function reliableCodexUsage(raw) {
  try {
    const events = raw.split(/\r?\n/).filter((line) => line.trim()).map((line) => JSON.parse(line));
    const completed = events.filter((event) => event?.type === 'turn.completed');
    if (completed.length !== 1 || events.at(-1) !== completed[0]) return null;
    const usage = completed[0].usage;
    for (const key of ['input_tokens', 'cached_input_tokens', 'output_tokens', 'reasoning_output_tokens']) {
      if (!Number.isInteger(usage?.[key]) || usage[key] < 0) return null;
    }
    return usage;
  } catch {
    return null;
  }
}

function attachReceivedCodexOutput(error, { rawJsonl, finalMessage }) {
  Object.defineProperty(error, RECEIVED_CODEX_OUTPUT, {
    configurable: false,
    enumerable: false,
    writable: false,
    value: Object.freeze({ rawJsonl, finalMessage, usage: reliableCodexUsage(rawJsonl) }),
  });
  return error;
}

function receivedCodexOutput(error) {
  return error?.[RECEIVED_CODEX_OUTPUT] || null;
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

// ─── `claude -p` product backend (Claude subscription login) ──────────────
// Ben, 2026-09-14: "Can you flip the codex cli to Claude cli?" The hosted
// worker's Claude path mirrors the Codex one: a private child environment
// (the subscription token, never an API key), no built-in tools, no user or
// project settings, no session written to disk, one JSON result per call
// with the CLI's own usage accounting.
const ISOLATED_CLAUDE_ENV_KEYS = Object.freeze([
  'PATH', 'HOME', 'USER', 'LOGNAME', 'SHELL', 'TMPDIR', 'TERM', 'LANG', 'LC_ALL',
  'SSL_CERT_FILE', 'SSL_CERT_DIR', 'NODE_EXTRA_CA_CERTS',
  'CLAUDE_CODE_OAUTH_TOKEN', 'CLAUDE_CONFIG_DIR',
]);
const CLAUDE_EFFORT_LEVELS = new Set(['low', 'medium', 'high', 'xhigh', 'max']);

function claudeChildEnv(source = process.env) {
  const env = Object.fromEntries(ISOLATED_CLAUDE_ENV_KEYS
    .filter((key) => source[key] !== undefined)
    .map((key) => [key, source[key]]));
  // Claude Code's own telemetry and nested-session markers stay out.
  env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = '1';
  env.DISABLE_AUTOUPDATER = '1';
  return env;
}

function buildClaudeExecArgs(opts = {}) {
  if (!opts.model || !/^[a-z0-9][a-z0-9.-]*$/i.test(opts.model)) throw new TypeError('model must be a simple model id');
  if (opts.effort !== undefined && !CLAUDE_EFFORT_LEVELS.has(opts.effort)) throw new TypeError('effort must be low, medium, high, xhigh or max');
  return [
    '-p',
    // stream-json, not json: Claude Code's `result` field is the last text
    // block of the last assistant message, so an answer the model emitted
    // as several text blocks (thinking between them at high effort) came
    // back as its tail alone. Metsera generation 6, 3.02 (Capitalization):
    // the result began mid-object ("...occurrence":0,"origin":"OWN"...)
    // and failed CLAUDE_PRODUCT_JSON twice. The stream carries one
    // assistant event per content block; the answer is every text block
    // in order.
    '--output-format', 'stream-json', '--verbose',
    '--model', opts.model,
    ...(opts.effort ? ['--effort', opts.effort] : []),
    '--no-session-persistence',
    '--tools', '',
    '--setting-sources', '',
    '--strict-mcp-config',
    '--permission-mode', 'dontAsk',
    ...(opts.systemPrompt ? ['--system-prompt', opts.systemPrompt] : []),
  ];
}

// The CLI's output: either one result object (--output-format json) or the
// stream (--output-format stream-json): one JSON object per line, among
// them one `assistant` event per content block and one final `result`
// event. The returned result object's `result` is every assistant text
// block joined in order (the stream's own `result` field is only the last
// one); `text_blocks` counts them.
function claudeJsonResult(raw) {
  const text = String(raw || '').trim();
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  let result = null;
  const texts = [];
  let assistantEvents = 0;
  for (const line of lines) {
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      throw new Error('CLAUDE_CLI_JSON: the result is not one JSON object');
    }
    if (!parsed || typeof parsed !== 'object') throw new Error('CLAUDE_CLI_JSON: the result is not a result object');
    if (parsed.type === 'assistant') {
      assistantEvents += 1;
      for (const block of parsed.message?.content || []) {
        if (block && block.type === 'text' && typeof block.text === 'string') texts.push(block.text);
      }
    } else if (parsed.type === 'result') {
      result = parsed;
    }
  }
  if (!result) throw new Error('CLAUDE_CLI_JSON: the result is not a result object');
  if (assistantEvents === 0) return result;
  return { ...result, result: texts.join(''), text_blocks: texts.length };
}

function createClaudeCliProductClient(opts = {}) {
  const model = opts.model;
  const effort = opts.effort;
  const timeoutMs = opts.timeoutMs || DEFAULT_TIMEOUT_MS;
  const env = opts.env || claudeChildEnv();
  if (!env.CLAUDE_CODE_OAUTH_TOKEN && !opts.allowAmbientLogin) {
    throw new Error('CLAUDE_CLI_LOGIN_REQUIRED: CLAUDE_CODE_OAUTH_TOKEN (from `claude setup-token`) is the only accepted credential');
  }
  const args = buildClaudeExecArgs({ model, effort, systemPrompt: opts.systemPrompt });
  return {
    backend: 'claude-cli-product',
    model,
    effort,
    args,
    messages: {
      create: async (params) => {
        const prompt = flattenMessages({ messages: params.messages });
        const callArgs = params.system ? buildClaudeExecArgs({ model, effort, systemPrompt: String(params.system) }) : args;
        await acquire();
        try {
          let raw;
          try {
            raw = await runProcess('claude', callArgs, prompt, timeoutMs, false, true, { env, cwd: opts.workingDirectory || os.tmpdir() });
          } catch (error) {
            const received = error?.[RECEIVED_PROCESS_STDOUT];
            if (received) attachReceivedClaudeOutput(error, received);
            throw error;
          }
          const result = claudeJsonResult(raw);
          if (result.is_error || result.subtype !== 'success') {
            const message = typeof result.result === 'string' ? result.result : JSON.stringify(result.result ?? result.subtype);
            throw attachReceivedClaudeOutput(new Error(`claude -p error: ${String(message).slice(0, 500)}`), raw);
          }
          return {
            content: [{ type: 'text', text: String(result.result ?? '') }],
            stop_reason: result.stop_reason ?? null,
            usage: result.usage || {},
            claude_completion: {
              status: 'COMPLETE', subtype: result.subtype, stop_reason: result.stop_reason ?? null,
              text_blocks: result.text_blocks ?? null,
            },
            total_cost_usd: result.total_cost_usd ?? null,
            duration_ms: result.duration_ms ?? null,
            duration_api_ms: result.duration_api_ms ?? null,
            num_turns: result.num_turns ?? null,
            session_id: result.session_id ?? null,
            model_usage: result.modelUsage ?? null,
          };
        } finally {
          release();
        }
      },
    },
  };
}

const RECEIVED_CLAUDE_OUTPUT = Symbol('receivedClaudeOutput');
function attachReceivedClaudeOutput(error, raw) {
  Object.defineProperty(error, RECEIVED_CLAUDE_OUTPUT, {
    configurable: false, enumerable: false, writable: false, value: String(raw),
  });
  return error;
}
function receivedClaudeOutput(error) {
  return error?.[RECEIVED_CLAUDE_OUTPUT] || null;
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
    ...(opts.outputLastMessagePath
      ? ['--output-last-message', opts.outputLastMessagePath] : []),
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
  const retryDelayMs = opts.retryDelayMs === undefined ? 15000 : opts.retryDelayMs;
  if (!Number.isInteger(retryDelayMs) || retryDelayMs < 0) {
    throw new TypeError('retryDelayMs must be a non-negative integer');
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
        const callDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-product-'));
        fs.chmodSync(callDirectory, 0o700);
        const workingDirectory = opts.isolated ? callDirectory : null;
        const finalMessagePath = path.join(callDirectory, 'final-message.json');
        await acquire();
        try {
          const execArgs = buildCodexExecArgs({
            ...opts, workingDirectory, outputLastMessagePath: finalMessagePath,
          });
          for (let attempt = 1; ; attempt++) {
            let raw;
            let finalMessage;
            try {
              fs.rmSync(finalMessagePath, { force: true });
              raw = await runProcess(
                'codex',
                execArgs,
                prompt,
                timeoutMs,
                false,
                opts.isolated === true,
              );
              try {
                finalMessage = fs.readFileSync(finalMessagePath, 'utf8');
              } catch {
                throw new Error('CODEX_FINAL_MESSAGE_REQUIRED: trusted final-message output is missing');
              }
              const response = codexJsonlResponse(raw, { finalMessage });
              return Object.freeze({ ...response, codex_invocation_identity: invocationIdentity });
            } catch (e) {
              if (raw === undefined && typeof e?.[RECEIVED_PROCESS_STDOUT] === 'string') {
                raw = e[RECEIVED_PROCESS_STDOUT];
                try {
                  finalMessage = fs.readFileSync(finalMessagePath, 'utf8');
                } catch {
                  finalMessage = undefined;
                }
              }
              const failure = raw === undefined ? e : attachReceivedCodexOutput(e, { rawJsonl: raw, finalMessage });
              if (attempt >= maxAttempts) throw failure;
              await new Promise((r) => setTimeout(r, retryDelayMs));
            }
          }
        } finally {
          release();
          fs.rmSync(callDirectory, { recursive: true, force: true });
        }
      },
    },
  };
}

const CODEX_RECONNECT_PROGRESS = /^Reconnecting\.\.\.\s?[1-5]\/5\s?\(stream disconnected before completion: Incomplete response returned, reason: content_filter\)$/;
const CODEX_HTTPS_FALLBACK_PROGRESS = 'Falling back from WebSockets to HTTPS transport. stream disconnected before completion: Incomplete response returned, reason: content_filter';

function codexTransportProgressType(event) {
  if (event?.type === 'error' && typeof event.message === 'string'
    && CODEX_RECONNECT_PROGRESS.test(event.message)) return 'RECONNECT';
  if (event?.type === 'item.completed' && event.item?.type === 'error'
    && event.item.message === CODEX_HTTPS_FALLBACK_PROGRESS) return 'HTTPS_FALLBACK';
  return null;
}

function codexJsonlResponse(raw, { finalMessage } = {}) {
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
  const transportProgress = [];
  for (const [index, event] of events.entries()) {
    if (!event || typeof event !== 'object' || Array.isArray(event)
      || typeof event.type !== 'string' || event.type.trim() === '') {
      throw new Error(`CODEX_JSONL_EVENT_MALFORMED: event ${index + 1} needs an object type`);
    }
    const transportProgressType = codexTransportProgressType(event);
    if (transportProgressType === 'RECONNECT' && event.item) {
      if (typeof event.item.type === 'string' && !['agent_message', 'reasoning', 'error'].includes(event.item.type)) {
        throw new Error(`CODEX_JSONL_TOOL_FORBIDDEN: item ${index + 1} has type ${event.item.type}`);
      }
      throw new Error(`CODEX_JSONL_TURN_FAILED: ${JSON.stringify(event).slice(0, 500)}`);
    }
    if (transportProgressType) transportProgress.push({ index, type: transportProgressType });
    if ((event.type === 'error' && !transportProgressType) || event.type.endsWith('.failed')) {
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
      const recoverableErrorItem = event.type === 'item.completed' && event.item.type === 'error'
        && transportProgressType === 'HTTPS_FALLBACK';
      if (!recoverableErrorItem) {
        if (event.item.type === 'error') {
          throw new Error(`CODEX_JSONL_TURN_FAILED: ${JSON.stringify(event.item).slice(0, 500)}`);
        }
        throw new Error(`CODEX_JSONL_TOOL_FORBIDDEN: item ${index + 1} has type ${event.item.type}`);
      }
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
  const hasTrustedFinalMessage = finalMessage !== undefined;
  if (!hasTrustedFinalMessage && answers.length !== 1) {
    throw new Error(`CODEX_JSONL_ANSWER_COUNT: expected one completed agent_message, got ${answers.length}`);
  }
  if (hasTrustedFinalMessage && answers.length === 0) {
    throw new Error('CODEX_JSONL_ANSWER_COUNT: expected at least one completed agent_message, got 0');
  }
  const answer = answers.at(-1);
  if (answers.some((item) => events.indexOf(item) <= events.indexOf(turnStarts[0]))) {
    throw new Error('CODEX_JSONL_LIFECYCLE_ORDER: agent answer must follow turn.started');
  }
  const text = answer.item.text.trim();
  if (!text) throw new Error('CODEX_JSONL_ANSWER_REQUIRED: completed agent_message text is empty');
  const turnStartIndex = events.indexOf(turnStarts[0]);
  const answerIndex = events.indexOf(answer);
  if (transportProgress.length > 0 && (!hasTrustedFinalMessage
    || transportProgress.some((item) => item.index <= turnStartIndex || item.index >= answerIndex))) {
    throw new Error('CODEX_JSONL_TRANSPORT_RECOVERY_UNVERIFIED: transport progress must precede one trusted final answer');
  }
  if (hasTrustedFinalMessage) {
    if (typeof finalMessage !== 'string' || finalMessage.trim() === '') {
      throw new Error('CODEX_FINAL_MESSAGE_REQUIRED: trusted final-message output is empty');
    }
    const candidate = finalMessage.trim();
    if (candidate !== text) throw new Error('CODEX_FINAL_MESSAGE_MISMATCH: trusted final message does not match the last completed agent_message');
    if (answers.filter((item) => item.item.text.trim() === candidate).length !== 1) {
      throw new Error('CODEX_FINAL_MESSAGE_AMBIGUOUS: trusted final message matches more than one completed agent_message');
    }
  }
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
    codex_completion: Object.freeze({
      status: 'COMPLETE', terminal_event: 'turn.completed',
      ...(transportProgress.length === 0 ? {} : {
        transport_recovery: Object.freeze({
          warning_count: transportProgress.length,
          warning_types: Object.freeze([...new Set(transportProgress.map((item) => item.type))]),
        }),
      }),
    }),
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
  ISOLATED_CLAUDE_ENV_KEYS,
  buildClaudeExecArgs,
  claudeChildEnv,
  claudeJsonResult,
  createClaudeCliProductClient,
  receivedClaudeOutput,
  isUsageLimitError,
  lastStdoutErrorMessage,
  ISOLATED_CODEX_ENV_KEYS,
  createClaudeCliClient,
  createCodexCliClient,
  codexInvocationIdentity,
  buildCodexExecArgs,
  assertCodexChatgptAuth,
  codexJsonlResponse,
  receivedCodexOutput,
  withPromptPrefixClient,
  JSON_ONLY_INSTRUCTION,
};
