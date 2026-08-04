'use strict';

const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { contentId, sha256Hex } = require('./canonical-bytes');
const { resolveDurableArtifactRoot } = require('./durable-artifact-root');
const { buildV1RenderedSurfaceAcquisitionPlan, ROSTER_SIZE } = require('./v1-output-routing-reconciliation-audit');

const SCHEMA = 'V1_RENDER_CAPTURE_EXECUTION_PREFLIGHT/V1';
const STATUS = 'NOT_STARTED';
const AUTHORITY = 'NOT_GRANTED';
const ENDPOINTS = Object.freeze([
  Object.freeze({ endpoint: '/api/deals?id=:deal_id', tables: Object.freeze(['deals', 'deal_topology', 'transaction_steps']) }),
  Object.freeze({ endpoint: '/api/provisions?deal_id=:deal_id', tables: Object.freeze(['deals', 'provisions', 'consideration_equity_provisions', 'consideration_treatments', 'election_mechanisms', 'election_options', 'proration_rules', 'transaction_steps']) }),
  Object.freeze({ endpoint: '/api/review/:deal_id/cards', tables: Object.freeze(['provision_cards', 'claims', 'transaction_steps', 'deals', 'provisions']) }),
  Object.freeze({ endpoint: '/api/agreement-source?deal_id=:deal_id', tables: Object.freeze(['deals']) }),
  Object.freeze({ endpoint: '/api/provision-types', tables: Object.freeze(['provision_types', 'provision_categories']) }),
]);
const NETWORK_ALLOWLIST = Object.freeze(['GET']);
const SQL_ALLOWLIST = Object.freeze(['SELECT']);

class V1RenderCapturePreflightError extends Error { constructor(code, message) { super(message); this.code = code; } }
function fail(code, message) { throw new V1RenderCapturePreflightError(code, message); }
function git(root, args) { try { return childProcess.execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { fail('GIT_STATE_UNAVAILABLE', 'Current Git state is required for a render-capture preflight.'); } }

function buildV1RenderCaptureExecutionPreflight({ repository_root: repositoryRoot, durable_output_root: durableOutputRoot, reviewer_mode: reviewerMode } = {}) {
  if (reviewerMode !== true) fail('REVIEWER_MODE_REQUIRED', 'Render capture preflight requires explicit reviewer_mode: true.');
  const acquisitionPlan = buildV1RenderedSurfaceAcquisitionPlan({ repository_root: repositoryRoot });
  if (acquisitionPlan.home_directory_roster.deal_ids.length !== ROSTER_SIZE) fail('ROSTER_INVALID', 'The capture preflight requires the exact 40-deal roster.');
  const outputRoot = resolveDurableArtifactRoot({ root: durableOutputRoot, certificationMode: true, requireExisting: true });
  const dependencyLock = path.join(repositoryRoot, 'package-lock.json');
  if (!fs.existsSync(dependencyLock)) fail('DEPENDENCY_LOCK_MISSING', 'package-lock.json is required for dry-run capture preflight.');
  const body = {
    schema_version: SCHEMA,
    status: STATUS,
    execution_authority: AUTHORITY,
    connection_state: 'NO_CONNECTION_OPENED',
    repository_root: repositoryRoot,
    durable_output_root: outputRoot,
    reviewer_mode: true,
    acquisition_plan_id: acquisitionPlan.acquisition_plan_id,
    roster_digest: acquisitionPlan.home_directory_roster.roster_digest,
    roster: acquisitionPlan.home_directory_roster.deal_ids,
    endpoint_inventory: ENDPOINTS,
    pagination_plan: Object.freeze({ claims_page_size: 1000, eof_required_for_every_endpoint: true }),
    network_method_allowlist: NETWORK_ALLOWLIST,
    sql_verb_allowlist: SQL_ALLOWLIST,
    git: Object.freeze({ head: git(repositoryRoot, ['rev-parse', 'HEAD']), status_sha256: sha256Hex(git(repositoryRoot, ['status', '--porcelain=v1'])) }),
    dependency_lock_sha256: sha256Hex(fs.readFileSync(dependencyLock)),
    separate_read_only_authority_required: true,
  };
  return Object.freeze({ ...body, preflight_id: contentId(SCHEMA, body) });
}

module.exports = { SCHEMA, STATUS, AUTHORITY, ENDPOINTS, NETWORK_ALLOWLIST, SQL_ALLOWLIST, V1RenderCapturePreflightError, buildV1RenderCaptureExecutionPreflight };
