'use strict';

const { CODEX_PROVIDER_ID } = require('./product-model-config');

const DISPOSABLE_BRANCH_REF = 'ecrtoofsyxozazkvsvcl';
const SANDBOX_NAME = 'pm-codex-preview-worker';
const SANDBOX_WORKDIR = '/vercel/sandbox/pm-product';
const SANDBOX_LAUNCHER = '/vercel/sandbox/pm-product/infra/codex-sandbox-worker/launch.sh';
const MINIMUM_SESSION_MS = 4 * 60 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertDisposableDatabaseUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== `${DISPOSABLE_BRANCH_REF}.supabase.co`) {
    throw new Error(`PRODUCT_SANDBOX_DATABASE_TARGET: expected ${DISPOSABLE_BRANCH_REF}`);
  }
}

async function wakeSandboxProductRun({
  runId,
  databaseUrl,
  serviceRoleKey,
  providerId,
  sandboxApi = null,
  now = Date.now,
}) {
  if (!UUID.test(runId || '')) throw new TypeError('runId must be a UUID');
  if (providerId !== CODEX_PROVIDER_ID) throw new Error('PRODUCT_SANDBOX_PROVIDER_MISMATCH');
  assertDisposableDatabaseUrl(databaseUrl);
  if (typeof serviceRoleKey !== 'string' || serviceRoleKey.length < 20) {
    throw new Error('PRODUCT_SANDBOX_SERVICE_KEY_REQUIRED');
  }
  const api = sandboxApi || require('@vercel/sandbox').Sandbox;
  const sandbox = await api.get({ name: SANDBOX_NAME, resume: true });
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
    env: { SUPABASE_URL: databaseUrl, SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey },
    detached: true,
    timeoutMs: MINIMUM_SESSION_MS,
  });
  return Object.freeze({
    schema_version: 'PRODUCT_SANDBOX_WAKE/V1',
    run_id: runId,
    sandbox_name: SANDBOX_NAME,
    command_id: command.cmdId,
  });
}

module.exports = {
  DISPOSABLE_BRANCH_REF,
  MINIMUM_SESSION_MS,
  SANDBOX_LAUNCHER,
  SANDBOX_NAME,
  SANDBOX_WORKDIR,
  assertDisposableDatabaseUrl,
  wakeSandboxProductRun,
};
