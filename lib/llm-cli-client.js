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

function childEnv() {
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY; // force subscription auth — see header
  return env;
}

function runProcess(cmd, args, stdinText, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { env: childEnv(), stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`${cmd} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(`${cmd} exited ${code}: ${err.slice(0, 500)}`));
      resolve(out);
    });
    child.stdin.write(stdinText);
    child.stdin.end();
  });
}

// Flatten an Anthropic messages array into one prompt string. The pipeline
// only ever sends a single user message, but handle the general case.
function flattenMessages(params) {
  const parts = [];
  if (params.system) {
    const sys = Array.isArray(params.system)
      ? params.system.map((b) => b.text || '').join('\n')
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

function anthropicShaped(text) {
  return { content: [{ type: 'text', text }], stop_reason: 'end_turn' };
}

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
                ['-p', '--output-format', 'json', '--model', model],
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
function createCodexCliClient(opts = {}) {
  const timeoutMs = opts.timeoutMs || DEFAULT_TIMEOUT_MS;
  const extraArgs = opts.model ? ['-m', opts.model] : [];
  return {
    backend: 'codex-cli',
    model: opts.model || 'gpt-default',
    messages: {
      create: async (params) => {
        const prompt = flattenMessages(params);
        await acquire();
        try {
          for (let attempt = 1; ; attempt++) {
            try {
              // `-` → read prompt from stdin. --output-last-message would need
              // a temp file; instead take stdout and strip the CLI's banner
              // lines (they're ANSI-decorated; the answer is plain).
              const raw = await runProcess(
                'codex',
                ['exec', '-s', 'read-only', '--color', 'never', ...extraArgs, '-'],
                prompt,
                timeoutMs,
              );
              const text = extractCodexAnswer(raw);
              if (!text) throw new Error('codex exec returned no answer text');
              return anthropicShaped(text);
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

// codex exec prints status lines, then the answer under a "codex" header,
// then a "tokens used" footer. Grab everything between the last "codex"
// marker line and the tokens footer; fall back to full stdout.
function extractCodexAnswer(raw) {
  const lines = raw.split('\n');
  let start = -1;
  let end = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*codex\s*$/.test(lines[i])) start = i + 1;
    if (/^\s*tokens used\s*$/i.test(lines[i]) && start !== -1) { end = i; break; }
  }
  const body = (start !== -1 ? lines.slice(start, end) : lines).join('\n').trim();
  return body;
}

module.exports = { createClaudeCliClient, createCodexCliClient };
