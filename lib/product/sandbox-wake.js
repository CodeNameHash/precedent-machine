'use strict';

const { ANTHROPIC_API_PROVIDER_ID, CLAUDE_CLI_PROVIDER_ID, isHostedProvider } = require('./product-model-config');

const DISPOSABLE_BRANCH_REF = 'ecrtoofsyxozazkvsvcl';
const SANDBOX_NAME = 'pm-codex-preview-worker';
const SANDBOX_WORKDIR = '/vercel/sandbox/pm-product';
const SANDBOX_LAUNCHER = '/vercel/sandbox/pm-product/infra/codex-sandbox-worker/launch.sh';
const MINIMUM_SESSION_MS = 4 * 60 * 60 * 1000;
const STARTUP_CHECK_DELAY_MS = 250;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Explicit Vercel credentials for the sandbox SDK when the caller is not a
// Vercel deployment (this repository's scripts run from a developer
// machine or a Claude Code environment): VERCEL_TOKEN, VERCEL_TEAM_ID and
// VERCEL_PROJECT_ID together. Absent, the SDK uses the deployment's OIDC
// token as before.
// A Vercel deployment exposes VERCEL_PROJECT_ID (and may expose
// VERCEL_TEAM_ID) as system variables without any token: those alone mean
// "use the OIDC default", never an error (generation 5 wake, 2026-09-14).
function sandboxCredentials(env = process.env) {
  const token = env.VERCEL_TOKEN;
  if (!token) return {};
  const teamId = env.VERCEL_TEAM_ID;
  const projectId = env.VERCEL_PROJECT_ID;
  if (!teamId || !projectId) throw new Error('PRODUCT_SANDBOX_CREDENTIALS: VERCEL_TOKEN needs VERCEL_TEAM_ID and VERCEL_PROJECT_ID');
  return { token, teamId, projectId };
}

// A named sandbox that cannot be resumed is gone for every caller: the
// record is missing (404), its snapshot is missing (410 snapshot_not_found
// in @vercel/sandbox 3.2.1's own check), or the older server reply the
// manager met on 2026-10-18 after a month idle ("Status code 400 is not
// ok: Cannot resume sandbox: no snapshot available"; work package 4, plan
// finding (49)). Any 400 or 404 on a resume counts too.
function isSandboxGone(error) {
  if (!error) return false;
  const status = Number(error?.response?.status ?? error?.status);
  const code = error?.json?.error?.code;
  const message = String(error?.message || '');
  if (status === 404 || code === 'snapshot_not_found' || code === 'not_found') return true;
  if (/not found|no snapshot available|snapshot_not_found/i.test(message)) return true;
  return status === 400 && /resume/i.test(message);
}

function assertDisposableDatabaseUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== `${DISPOSABLE_BRANCH_REF}.supabase.co`) {
    throw new Error(`PRODUCT_SANDBOX_DATABASE_TARGET: expected ${DISPOSABLE_BRANCH_REF}`);
  }
  return url.origin;
}

// The named sandbox, resumed; a sandbox that cannot be resumed is
// PRODUCT_SANDBOX_GONE (the run route turns this into a 503 naming the
// code; the fix is scripts/product/create-sandbox-worker.js, run by the
// operator).
async function resumeNamedSandbox(api) {
  try {
    return await api.get({ name: SANDBOX_NAME, resume: true, ...sandboxCredentials() });
  } catch (error) {
    if (isSandboxGone(error)) {
      const gone = new Error(`PRODUCT_SANDBOX_GONE: ${SANDBOX_NAME} cannot be resumed (${String(error.message || error).slice(0, 200)}); recreate it with scripts/product/create-sandbox-worker.js`);
      gone.code = 'PRODUCT_SANDBOX_GONE';
      gone.cause = error;
      throw gone;
    }
    throw error;
  }
}

// The session's remaining time, and an extension back to MINIMUM_SESSION_MS
// when it has less. Returns { created_at, remaining_before_ms, extended_ms }.
async function ensureSessionTime(sandbox, now = Date.now) {
  const session = typeof sandbox.currentSession === 'function' ? sandbox.currentSession() : sandbox;
  const createdAt = session.createdAt instanceof Date ? session.createdAt.getTime() : Number.NaN;
  const remaining = Number.isFinite(createdAt) && Number.isFinite(session.timeout)
    ? Math.max(0, createdAt + session.timeout - now()) : Number.NaN;
  let extended = 0;
  if (Number.isFinite(remaining) && remaining < MINIMUM_SESSION_MS) {
    extended = MINIMUM_SESSION_MS - remaining;
    await sandbox.extendTimeout(extended);
  }
  return { created_at: Number.isFinite(createdAt) ? new Date(createdAt).toISOString() : null, remaining_before_ms: Number.isFinite(remaining) ? remaining : null, extended_ms: extended };
}

// Work package 8 (manager, 2026-10-18): generation 8's worker died at about
// 06:10 UTC because the session the 02:07 wake created ran under its
// four-hour timeout and a generation takes six; the wake extends the
// timeout only when it fires. @vercel/sandbox 3.2.1 addresses a sandbox by
// name through an API client that needs Vercel credentials (a token with
// team and project, or the deployment's OIDC token) and sets no identity
// or credential inside the sandbox, so the worker cannot extend its own
// session without carrying a credential the launcher deliberately keeps
// out of it. The route's keepalive therefore does it from the deployment:
// resume the named sandbox and give its session MINIMUM_SESSION_MS again,
// launching nothing (POST .../run { keepalive: true }; the monitor calls
// it each check).
async function keepSandboxAlive({ sandboxApi = null, now = Date.now } = {}) {
  const api = sandboxApi || (await import('@vercel/sandbox')).Sandbox;
  const sandbox = await resumeNamedSandbox(api);
  const time = await ensureSessionTime(sandbox, now);
  return Object.freeze({
    schema_version: 'PRODUCT_SANDBOX_KEEPALIVE/V1',
    sandbox_name: SANDBOX_NAME,
    session_created_at: time.created_at,
    remaining_before_ms: time.remaining_before_ms,
    extended_ms: time.extended_ms,
    remaining_after_ms: time.remaining_before_ms === null ? null : time.remaining_before_ms + time.extended_ms,
  });
}

async function wakeSandboxProductRun({
  runId,
  databaseUrl,
  serviceRoleKey,
  providerId,
  claudeOauthToken = null,
  anthropicApiKey = null,
  sandboxApi = null,
  now = Date.now,
}) {
  if (!UUID.test(runId || '')) throw new TypeError('runId must be a UUID');
  if (!isHostedProvider(providerId)) throw new Error('PRODUCT_SANDBOX_PROVIDER_MISMATCH');
  // The Claude path carries the subscription login into the sandbox as
  // CLAUDE_CODE_OAUTH_TOKEN (from `claude setup-token`), never an API key.
  if (providerId === CLAUDE_CLI_PROVIDER_ID && (typeof claudeOauthToken !== 'string' || claudeOauthToken.length < 20)) {
    throw new Error('PRODUCT_SANDBOX_CLAUDE_TOKEN_REQUIRED');
  }
  // The API path carries ANTHROPIC_API_KEY from the deployment the same way
  // (work package 3; Ben, 2026-10-17: "done on the key, will be live on
  // your next redploy"), and only for that provider.
  if (providerId === ANTHROPIC_API_PROVIDER_ID && (typeof anthropicApiKey !== 'string' || anthropicApiKey.length < 20)) {
    throw new Error('PRODUCT_SANDBOX_ANTHROPIC_API_KEY_REQUIRED');
  }
  const normalisedDatabaseUrl = assertDisposableDatabaseUrl(databaseUrl);
  if (typeof serviceRoleKey !== 'string' || serviceRoleKey.length < 20) {
    throw new Error('PRODUCT_SANDBOX_SERVICE_KEY_REQUIRED');
  }
  const api = sandboxApi || (await import('@vercel/sandbox')).Sandbox;
  const sandbox = await resumeNamedSandbox(api);
  await ensureSessionTime(sandbox, now);
  const command = await sandbox.runCommand({
    cmd: SANDBOX_LAUNCHER,
    args: [runId],
    cwd: SANDBOX_WORKDIR,
    env: {
      SUPABASE_URL: normalisedDatabaseUrl,
      SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
      PRODUCT_MODEL_PROVIDER: providerId,
      ...(providerId === CLAUDE_CLI_PROVIDER_ID ? { CLAUDE_CODE_OAUTH_TOKEN: claudeOauthToken } : {}),
      ...(providerId === ANTHROPIC_API_PROVIDER_ID ? { ANTHROPIC_API_KEY: anthropicApiKey } : {}),
    },
    detached: true,
    timeoutMs: MINIMUM_SESSION_MS,
  });
  const startupController = new AbortController();
  // End only the status wait; the detached worker must keep running.
  const startupTimer = setTimeout(() => startupController.abort(), STARTUP_CHECK_DELAY_MS);
  let startup;
  try {
    startup = await command.wait({ signal: startupController.signal });
  } catch (error) {
    if (!startupController.signal.aborted
      || (error !== startupController.signal.reason && error?.name !== 'AbortError')) throw error;
  } finally {
    clearTimeout(startupTimer);
  }
  if (startup && Number.isInteger(startup.exitCode) && startup.exitCode !== 0) {
    throw new Error(`PRODUCT_SANDBOX_STARTUP_FAILED: command exited ${startup.exitCode}`);
  }
  return Object.freeze({
    schema_version: 'PRODUCT_SANDBOX_WAKE/V1',
    run_id: runId,
    sandbox_name: SANDBOX_NAME,
    command_id: command.cmdId,
  });
}

module.exports = {
  isSandboxGone,
  keepSandboxAlive,
  sandboxCredentials,
  DISPOSABLE_BRANCH_REF,
  MINIMUM_SESSION_MS,
  STARTUP_CHECK_DELAY_MS,
  SANDBOX_LAUNCHER,
  SANDBOX_NAME,
  SANDBOX_WORKDIR,
  assertDisposableDatabaseUrl,
  wakeSandboxProductRun,
};
