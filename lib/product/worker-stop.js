'use strict';

// Work package 11b (plan finding (73)). An error that is the account's, not
// the section's: a usage limit on the Codex or Claude login or the API
// account, or an API key the account refuses for want of its workspace
// header. The hosted worker stops on it with the reason after one attempt
// instead of burning every section's attempts (NCS generation 5 on the
// API, 2026-10-18 13:11 UTC: two sections burnt three attempts each in six
// seconds and the run FAILED, though the stop rule was in the worker,
// because the section loop in analysis-runner.js recorded each failure
// and returned the analysis without rethrowing). One test, used by the
// section loop (to rethrow) and by the worker (to name its exit reason).

const { isUsageLimitError } = require('../llm-cli-client');
const { isNotConfiguredError } = require('./anthropic-api-model');

// The worker's exit reason for a stop error, or null for a section failure.
function workerStopReason(error) {
  if (isNotConfiguredError(error)) return 'PRODUCT_HOSTED_ANTHROPIC_API_NOT_CONFIGURED';
  // The code keeps its name for every login and account (plan finding (46)).
  if (isUsageLimitError(error)) return 'PRODUCT_HOSTED_CODEX_USAGE_LIMIT';
  return null;
}

function isWorkerStopError(error) {
  return workerStopReason(error) !== null;
}

module.exports = { isWorkerStopError, workerStopReason };
