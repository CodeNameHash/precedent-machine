'use strict';

const { ANTHROPIC_API_PROVIDER_ID, CLAUDE_CLI_PROVIDER_ID, DEEPSEEK_API_PROVIDER_ID, isHostedProvider } = require('./product-model-config');
const { SANDBOX_POOL_SIZE, isSandboxPoolName, sandboxPoolNames } = require('./sandbox-pool');

// The one database a sandbox worker may write: the product project
// (plan finding (289), the two-database split of 2026-10-27). Until then it
// was the disposable preview branch ecrtoofsyxozazkvsvcl, now orphaned; the
// wake of 2026-10-28 (Ben: "Rerun and also run sketchers and a qxo deal")
// was refused because the run route still handed the sandbox SUPABASE_URL,
// which is the V1 corpus since the split. The guard keeps the V1 corpus
// (tzulhdasmioeechxapdy) out of a sandbox's reach by construction.
const DISPOSABLE_BRANCH_REF = 'sjumbznveyyiizhwvixj';
// The pool of named sandboxes (plan finding (140)); the first keeps the name
// every earlier wake used. A wake or keepalive names the sandbox the run is
// on; the run route takes it from the run's assignment.
const SANDBOX_POOL = sandboxPoolNames(SANDBOX_POOL_SIZE);
const SANDBOX_NAME = SANDBOX_POOL[0];
const SANDBOX_WORKDIR = '/vercel/sandbox/pm-product';
const SANDBOX_LAUNCHER = '/vercel/sandbox/pm-product/infra/codex-sandbox-worker/launch.sh';
// Work package E2 (implementer E; the manager, 2026-10-19 02:55 UTC): the
// experiments sandbox, outside the run pool so no run is ever placed on it,
// created by the operator with scripts/product/create-sandbox-worker.js
// --name pm-codex-preview-worker-3 for the CLI provider. The ablation job
// (scripts/product/cost-ablation.js through its own launcher) runs there
// through the same wake path a run uses, with the same environment, and
// writes under /vercel/sandbox/pm-ablation-<timestamp>/ and nothing to the
// product tables.
const ABLATION_SANDBOX_NAME = 'pm-codex-preview-worker-3';
const ABLATION_LAUNCHER = '/vercel/sandbox/pm-product/infra/codex-sandbox-worker/ablation-launch.sh';
const ABLATION_JOB_ROOT = '/vercel/sandbox';
const ABLATION_JOB_ID = /^pm-ablation-[0-9]{8}T[0-9]{6}Z$/;
const ABLATION_STATUS_TAIL_BYTES = 12000;
const KNOWN_SANDBOX_NAMES = Object.freeze([...SANDBOX_POOL, ABLATION_SANDBOX_NAME]);
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

function assertPoolSandboxName(name) {
  if (!isSandboxPoolName(name, SANDBOX_POOL)) throw new Error(`PRODUCT_SANDBOX_NAME_INVALID: ${String(name).slice(0, 60)} is not in the pool (${SANDBOX_POOL.join(', ')})`);
  return name;
}

// A sandbox this module may resume at all: the pool, or the experiments
// sandbox (work package E2). The scripts that create and update sandboxes
// take the same set.
function isKnownSandboxName(name) {
  return typeof name === 'string' && KNOWN_SANDBOX_NAMES.includes(name);
}

function assertKnownSandboxName(name) {
  if (!isKnownSandboxName(name)) throw new Error(`PRODUCT_SANDBOX_NAME_INVALID: ${String(name).slice(0, 60)} is not a known sandbox (${KNOWN_SANDBOX_NAMES.join(', ')})`);
  return name;
}

// The named sandbox, resumed; a sandbox that cannot be resumed is
// PRODUCT_SANDBOX_GONE (the run route turns this into a 503 naming the
// code; the fix is scripts/product/create-sandbox-worker.js --name <name>,
// run by the operator).
async function resumeNamedSandbox(api, sandboxName = SANDBOX_NAME, { allowExperiments = false } = {}) {
  const name = allowExperiments ? assertKnownSandboxName(sandboxName) : assertPoolSandboxName(sandboxName);
  try {
    return await api.get({ name, resume: true, ...sandboxCredentials() });
  } catch (error) {
    if (isSandboxGone(error)) {
      const gone = new Error(`PRODUCT_SANDBOX_GONE: ${name} cannot be resumed (${String(error.message || error).slice(0, 200)}); recreate it with scripts/product/create-sandbox-worker.js --name ${name}`);
      gone.code = 'PRODUCT_SANDBOX_GONE';
      gone.sandbox_name = name;
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
async function keepSandboxAlive({ sandboxName = SANDBOX_NAME, sandboxApi = null, now = Date.now } = {}) {
  const api = sandboxApi || (await import('@vercel/sandbox')).Sandbox;
  const sandbox = await resumeNamedSandbox(api, sandboxName);
  const time = await ensureSessionTime(sandbox, now);
  return Object.freeze({
    schema_version: 'PRODUCT_SANDBOX_KEEPALIVE/V1',
    sandbox_name: sandboxName,
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
  anthropicWorkspaceId = null,
  deepseekApiKey = null,
  // The sandbox the run owns (lib/product/sandbox-pool.js); the first of
  // the pool for a caller without one.
  sandboxName = SANDBOX_NAME,
  sandboxApi = null,
  now = Date.now,
}) {
  if (!UUID.test(runId || '')) throw new TypeError('runId must be a UUID');
  assertPoolSandboxName(sandboxName);
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
  // The DeepSeek path carries DEEPSEEK_API_KEY from the deployment the same
  // way, and only for that provider (2026-10-23).
  if (providerId === DEEPSEEK_API_PROVIDER_ID && (typeof deepseekApiKey !== 'string' || deepseekApiKey.length < 20)) {
    throw new Error('PRODUCT_SANDBOX_DEEPSEEK_API_KEY_REQUIRED');
  }
  // Work package 11 (plan finding (70)): an organisation-level key needs
  // the workspace id beside it; optional, passed only when set, only for
  // this provider, and never written anywhere.
  const workspaceId = providerId === ANTHROPIC_API_PROVIDER_ID && typeof anthropicWorkspaceId === 'string' && anthropicWorkspaceId.trim()
    ? anthropicWorkspaceId.trim() : null;
  const normalisedDatabaseUrl = assertDisposableDatabaseUrl(databaseUrl);
  if (typeof serviceRoleKey !== 'string' || serviceRoleKey.length < 20) {
    throw new Error('PRODUCT_SANDBOX_SERVICE_KEY_REQUIRED');
  }
  const api = sandboxApi || (await import('@vercel/sandbox')).Sandbox;
  const sandbox = await resumeNamedSandbox(api, sandboxName);
  await ensureSessionTime(sandbox, now);
  const command = await sandbox.runCommand({
    cmd: SANDBOX_LAUNCHER,
    args: [runId],
    cwd: SANDBOX_WORKDIR,
    env: {
      SUPABASE_URL: normalisedDatabaseUrl,
      SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
      PRODUCT_MODEL_PROVIDER: providerId,
      // The worker names its sandbox in its worker ids (work package D3),
      // so a worker that starts after a restart knows which claims were its
      // own sandbox's dead process's.
      PRODUCT_SANDBOX_NAME: sandboxName,
      ...(providerId === CLAUDE_CLI_PROVIDER_ID ? { CLAUDE_CODE_OAUTH_TOKEN: claudeOauthToken } : {}),
      ...(providerId === ANTHROPIC_API_PROVIDER_ID ? { ANTHROPIC_API_KEY: anthropicApiKey } : {}),
      ...(providerId === DEEPSEEK_API_PROVIDER_ID ? { DEEPSEEK_API_KEY: deepseekApiKey } : {}),
      ...(workspaceId ? { ANTHROPIC_WORKSPACE_ID: workspaceId } : {}),
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
    sandbox_name: sandboxName,
    command_id: command.cmdId,
  });
}

// The credentials a wake carries for a provider, checked the way a run
// wake checks them (one place for both wakes).
function providerEnvironment({ providerId, claudeOauthToken, anthropicApiKey, anthropicWorkspaceId, deepseekApiKey }) {
  if (!isHostedProvider(providerId)) throw new Error('PRODUCT_SANDBOX_PROVIDER_MISMATCH');
  if (providerId === CLAUDE_CLI_PROVIDER_ID && (typeof claudeOauthToken !== 'string' || claudeOauthToken.length < 20)) {
    throw new Error('PRODUCT_SANDBOX_CLAUDE_TOKEN_REQUIRED');
  }
  if (providerId === ANTHROPIC_API_PROVIDER_ID && (typeof anthropicApiKey !== 'string' || anthropicApiKey.length < 20)) {
    throw new Error('PRODUCT_SANDBOX_ANTHROPIC_API_KEY_REQUIRED');
  }
  if (providerId === DEEPSEEK_API_PROVIDER_ID && (typeof deepseekApiKey !== 'string' || deepseekApiKey.length < 20)) {
    throw new Error('PRODUCT_SANDBOX_DEEPSEEK_API_KEY_REQUIRED');
  }
  const workspaceId = providerId === ANTHROPIC_API_PROVIDER_ID && typeof anthropicWorkspaceId === 'string' && anthropicWorkspaceId.trim()
    ? anthropicWorkspaceId.trim() : null;
  return {
    PRODUCT_MODEL_PROVIDER: providerId,
    ...(providerId === CLAUDE_CLI_PROVIDER_ID ? { CLAUDE_CODE_OAUTH_TOKEN: claudeOauthToken } : {}),
    ...(providerId === ANTHROPIC_API_PROVIDER_ID ? { ANTHROPIC_API_KEY: anthropicApiKey } : {}),
    ...(providerId === DEEPSEEK_API_PROVIDER_ID ? { DEEPSEEK_API_KEY: deepseekApiKey } : {}),
    ...(workspaceId ? { ANTHROPIC_WORKSPACE_ID: workspaceId } : {}),
  };
}

// Wait STARTUP_CHECK_DELAY_MS for a detached command to fail at once (a
// launcher check), then let it run.
async function startupCheck(command) {
  const startupController = new AbortController();
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
}

function ablationJobId(now = Date.now) {
  return `pm-ablation-${new Date(now()).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}`;
}

function assertAblationJobId(jobId) {
  if (!ABLATION_JOB_ID.test(jobId || '')) throw new Error(`PRODUCT_ABLATION_JOB_ID_INVALID: ${String(jobId).slice(0, 60)}`);
  return jobId;
}

const SECTION_REFERENCE = /^[A-Za-z0-9][A-Za-z0-9.()_-]{0,39}$/;
const VARIANT_NAME = /^[a-z][a-z0-9_]{0,39}$/;

// Work package E2: the ablation job on the experiments sandbox. Resumes the
// named sandbox (the experiments sandbox unless another known one is
// named), gives its session MINIMUM_SESSION_MS, and runs the ablation
// launcher detached with the job id, run id, sections and variants as
// arguments and the same environment a run wake passes (the preview
// database and the provider's credential, nothing else). The launcher
// writes everything under ABLATION_JOB_ROOT/<job id>/ (job.log, the rows
// snapshot, ablation.md, ablation.json, the recording, the analysis files
// for compare-generations and exit-code when it ends) and nothing to the
// product tables.
async function wakeSandboxAblation({
  runId, sections, variants, databaseUrl, serviceRoleKey, providerId,
  claudeOauthToken = null, anthropicApiKey = null, anthropicWorkspaceId = null,
  sandboxName = ABLATION_SANDBOX_NAME, sandboxApi = null, now = Date.now, jobId = null, loops = 1,
}) {
  if (!UUID.test(runId || '')) throw new TypeError('runId must be a UUID');
  assertKnownSandboxName(sandboxName);
  if (!Array.isArray(sections) || sections.length === 0 || sections.length > 50 || sections.some((item) => !SECTION_REFERENCE.test(item))) {
    throw new Error('PRODUCT_ABLATION_SECTIONS_INVALID');
  }
  if (!Array.isArray(variants) || variants.length === 0 || variants.length > 40 || variants.some((item) => !VARIANT_NAME.test(item))) {
    throw new Error('PRODUCT_ABLATION_VARIANTS_INVALID');
  }
  const provider = providerEnvironment({ providerId, claudeOauthToken, anthropicApiKey, anthropicWorkspaceId });
  const normalisedDatabaseUrl = assertDisposableDatabaseUrl(databaseUrl);
  if (typeof serviceRoleKey !== 'string' || serviceRoleKey.length < 20) throw new Error('PRODUCT_SANDBOX_SERVICE_KEY_REQUIRED');
  const job = assertAblationJobId(jobId || ablationJobId(now));
  const loopsCount = Number(loops);
  if (!Number.isInteger(loopsCount) || loopsCount < 1 || loopsCount > 16) throw new Error('PRODUCT_ABLATION_LOOPS_INVALID');
  const api = sandboxApi || (await import('@vercel/sandbox')).Sandbox;
  const sandbox = await resumeNamedSandbox(api, sandboxName, { allowExperiments: true });
  await ensureSessionTime(sandbox, now);
  const command = await sandbox.runCommand({
    cmd: ABLATION_LAUNCHER,
    // Plan finding (193): the fifth argument, sections at once, only when more than one.
    args: [job, runId, sections.join(','), variants.join(','), ...(loopsCount > 1 ? [String(loopsCount)] : [])],
    cwd: SANDBOX_WORKDIR,
    env: {
      SUPABASE_URL: normalisedDatabaseUrl,
      SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
      ...provider,
    },
    detached: true,
    timeoutMs: MINIMUM_SESSION_MS,
  });
  await startupCheck(command);
  return Object.freeze({
    schema_version: 'PRODUCT_SANDBOX_ABLATION_WAKE/V1',
    job_id: job,
    job_dir: `${ABLATION_JOB_ROOT}/${job}`,
    run_id: runId,
    sandbox_name: sandboxName,
    provider_id: providerId,
    sections: [...sections],
    variants: [...variants],
    loops: loopsCount,
    command_id: command.cmdId,
  });
}

// The shell that reads a job's state on the sandbox: the job directory
// (the one named, else the latest), its exit code when the launcher has
// written one, the log's tail and the table when it exists. Fixed text;
// the only variable is the job id, validated above.
function ablationStatusScript(jobId, tailBytes) {
  const pick = jobId ? `d=${ABLATION_JOB_ROOT}/${jobId}` : `d=$(ls -d ${ABLATION_JOB_ROOT}/pm-ablation-* 2>/dev/null | sort | tail -n 1)`;
  return [
    `${pick}`,
    'if [ -z "$d" ] || [ ! -d "$d" ]; then printf \'%s\\n\' "JOB_DIR="; exit 0; fi',
    'printf \'%s\\n\' "JOB_DIR=$d"',
    'ls -d /vercel/sandbox/pm-ablation-* 2>/dev/null | sort | sed \'s#.*/##; s#^#JOB=#\'',
    'if [ -f "$d/exit-code" ]; then printf \'%s\\n\' "EXIT_CODE=$(cat "$d/exit-code")"; fi',
    'printf \'%s\\n\' "---LOG"',
    `if [ -f "$d/job.log" ]; then tail -c ${tailBytes} "$d/job.log"; fi`,
    'printf \'\\n%s\\n\' "---TABLE"',
    'if [ -f "$d/ablation.md" ]; then cat "$d/ablation.md"; fi',
  ].join('\n');
}

function parseAblationStatus(output) {
  const text = String(output || '');
  const [head, rest = ''] = text.split('\n---LOG\n');
  const [log, table = ''] = rest.split('\n---TABLE\n');
  const lines = head.split('\n');
  const jobDir = (lines.find((line) => line.startsWith('JOB_DIR=')) || 'JOB_DIR=').slice('JOB_DIR='.length).trim();
  const exitLine = lines.find((line) => line.startsWith('EXIT_CODE='));
  const exitCode = exitLine ? Number(exitLine.slice('EXIT_CODE='.length).trim()) : null;
  const jobs = lines.filter((line) => line.startsWith('JOB=')).map((line) => line.slice(4).trim()).filter(Boolean);
  return {
    job_id: jobDir ? jobDir.split('/').pop() : null,
    job_dir: jobDir || null,
    jobs,
    state: !jobDir ? 'NOT_FOUND' : (Number.isInteger(exitCode) ? (exitCode === 0 ? 'DONE' : 'FAILED') : 'RUNNING'),
    exit_code: Number.isInteger(exitCode) ? exitCode : null,
    log_tail: log.replace(/\n$/, ''),
    table: table.trim() ? table.replace(/\n$/, '') : null,
  };
}

// Work package E2 (b): the job's state read from the sandbox, for the
// route's { status: true }: resumes the sandbox (no session extension; a
// read is not a wake) and runs the status shell, not detached.
async function readSandboxAblationStatus({ sandboxName = ABLATION_SANDBOX_NAME, jobId = null, sandboxApi = null, tailBytes = ABLATION_STATUS_TAIL_BYTES } = {}) {
  assertKnownSandboxName(sandboxName);
  if (jobId !== null) assertAblationJobId(jobId);
  const api = sandboxApi || (await import('@vercel/sandbox')).Sandbox;
  const sandbox = await resumeNamedSandbox(api, sandboxName, { allowExperiments: true });
  const command = await sandbox.runCommand({ cmd: 'sh', args: ['-c', ablationStatusScript(jobId, tailBytes)], cwd: ABLATION_JOB_ROOT, detached: false });
  const stdout = typeof command.stdout === 'function' ? await command.stdout() : '';
  const exitCode = Number.isInteger(command.exitCode) ? command.exitCode : (typeof command.wait === 'function' ? (await command.wait()).exitCode : 0);
  if (exitCode !== 0) throw new Error(`PRODUCT_ABLATION_STATUS_FAILED: status command exited ${exitCode}`);
  return Object.freeze({ schema_version: 'PRODUCT_SANDBOX_ABLATION_STATUS/V1', sandbox_name: sandboxName, ...parseAblationStatus(stdout) });
}

module.exports = {
  ABLATION_JOB_ROOT,
  ABLATION_LAUNCHER,
  ABLATION_SANDBOX_NAME,
  KNOWN_SANDBOX_NAMES,
  ablationJobId,
  ablationStatusScript,
  assertAblationJobId,
  assertKnownSandboxName,
  isKnownSandboxName,
  parseAblationStatus,
  readSandboxAblationStatus,
  wakeSandboxAblation,
  isSandboxGone,
  keepSandboxAlive,
  sandboxCredentials,
  DISPOSABLE_BRANCH_REF,
  MINIMUM_SESSION_MS,
  STARTUP_CHECK_DELAY_MS,
  SANDBOX_LAUNCHER,
  SANDBOX_NAME,
  SANDBOX_POOL,
  SANDBOX_WORKDIR,
  assertPoolSandboxName,
  assertDisposableDatabaseUrl,
  wakeSandboxProductRun,
};
