'use strict';

const { CLAUDE_CLI_PROVIDER_ID, isHostedProvider } = require('./product-model-config');

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

function assertDisposableDatabaseUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== `${DISPOSABLE_BRANCH_REF}.supabase.co`) {
    throw new Error(`PRODUCT_SANDBOX_DATABASE_TARGET: expected ${DISPOSABLE_BRANCH_REF}`);
  }
  return url.origin;
}

async function wakeSandboxProductRun({
  runId,
  databaseUrl,
  serviceRoleKey,
  providerId,
  claudeOauthToken = null,
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
  const normalisedDatabaseUrl = assertDisposableDatabaseUrl(databaseUrl);
  if (typeof serviceRoleKey !== 'string' || serviceRoleKey.length < 20) {
    throw new Error('PRODUCT_SANDBOX_SERVICE_KEY_REQUIRED');
  }
  const api = sandboxApi || (await import('@vercel/sandbox')).Sandbox;
  const sandbox = await api.get({ name: SANDBOX_NAME, resume: true, ...sandboxCredentials() });
  const session = typeof sandbox.currentSession === 'function' ? sandbox.currentSession() : sandbox;
  const createdAt = session.createdAt instanceof Date ? session.createdAt.getTime() : Number.NaN;
  const remaining = Number.isFinite(createdAt) && Number.isFinite(session.timeout)
    ? Math.max(0, createdAt + session.timeout - now()) : Number.NaN;
  if (Number.isFinite(remaining) && remaining < MINIMUM_SESSION_MS) {
    await sandbox.extendTimeout(MINIMUM_SESSION_MS - remaining);
  }
  const command = await sandbox.runCommand({
    cmd: SANDBOX_LAUNCHER,
    args: [runId],
    cwd: SANDBOX_WORKDIR,
    env: {
      SUPABASE_URL: normalisedDatabaseUrl,
      SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
      PRODUCT_MODEL_PROVIDER: providerId,
      ...(providerId === CLAUDE_CLI_PROVIDER_ID ? { CLAUDE_CODE_OAUTH_TOKEN: claudeOauthToken } : {}),
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
