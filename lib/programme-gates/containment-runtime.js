const { execFile } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

async function runCommand(command, args, options = {}) {
  const startedAt = new Date().toISOString();
  try {
    const result = await execFileAsync(command, args, {
      cwd: options.cwd,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      env: options.env,
    });
    return Object.freeze({
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      exit_code: 0,
      stdout: result.stdout || '',
      stderr: result.stderr || '',
    });
  } catch (error) {
    return Object.freeze({
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      exit_code: Number.isInteger(error.code) ? error.code : 1,
      stdout: error.stdout || '',
      stderr: error.stderr || String(error.message || error),
    });
  }
}

const CONTAINMENT_RUNTIME = Object.freeze({
  readFile(file) {
    return fs.readFileSync(file);
  },
  fileExists(file) {
    return fs.existsSync(file);
  },
  resolve(...parts) {
    return path.resolve(...parts);
  },
  now() {
    return new Date();
  },
  fetch(input, init) {
    return fetch(input, init);
  },
  runCommand,
});

function validateDeploymentBinding({
  deployment,
  deploymentId,
  environment,
  codeCommit,
  specificationRoot,
}) {
  if (!deployment || typeof deployment !== 'object' || Array.isArray(deployment)) {
    throw new TypeError('Vercel deployment inspection must be an object');
  }
  if (deployment.id !== deploymentId || deployment.readyState !== 'READY') {
    throw new Error('the supplied deployment ID is not the READY deployment at the origin');
  }
  if (
    (environment === 'PRODUCTION' && deployment.target !== 'production')
    || (environment === 'STAGING' && deployment.target === 'production')
  ) {
    throw new Error('the deployment target does not match the evidence environment');
  }
  if (deployment.meta?.programmeCodeCommit !== codeCommit) {
    throw new Error('the deployment metadata does not bind the exact code commit');
  }
  if (deployment.meta?.programmeSpecificationRoot !== specificationRoot) {
    throw new Error('the deployment metadata does not bind the exact specification root');
  }
  return true;
}

module.exports = {
  CONTAINMENT_RUNTIME,
  runCommand,
  validateDeploymentBinding,
};
