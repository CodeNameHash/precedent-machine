import { createHash } from 'node:crypto';
import {
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

export const CANONICAL_V2_STAGING_PROJECT = Object.freeze({
  ref: 'sjumbznveyyiizhwvixj',
  name: 'deal-corpus-canonical-v2-staging',
});

const DEFAULT_BOUNDS = Object.freeze({
  statementTimeoutMs: 60_000,
  processTimeoutMs: 90_000,
  maxSqlBytes: 1536 * 1024,
  maxResponseBytes: 4 * 1024 * 1024,
  maxProcessBufferBytes: 6 * 1024 * 1024,
  maxDiagnosticChars: 500,
});
const BOUND_RANGES = Object.freeze({
  statementTimeoutMs: Object.freeze([1, 120_000]),
  processTimeoutMs: Object.freeze([1, 180_000]),
  maxSqlBytes: Object.freeze([1, 6 * 1024 * 1024]),
  maxResponseBytes: Object.freeze([1, 6 * 1024 * 1024]),
  maxProcessBufferBytes: Object.freeze([1, 8 * 1024 * 1024]),
  maxDiagnosticChars: Object.freeze([1, 2_000]),
});

function normaliseBounds(overrides = {}) {
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) {
    throw new TypeError('Canonical staging runtime bounds must be an object.');
  }
  const unknown = Object.keys(overrides).filter((key) => !(key in DEFAULT_BOUNDS));
  if (unknown.length > 0) {
    throw new TypeError(`Unknown canonical staging runtime bound: ${unknown.sort().join(', ')}.`);
  }
  const bounds = { ...DEFAULT_BOUNDS, ...overrides };
  for (const [key, [minimum, maximum]] of Object.entries(BOUND_RANGES)) {
    if (!Number.isInteger(bounds[key]) || bounds[key] < minimum || bounds[key] > maximum) {
      throw new TypeError(`${key} must be an integer between ${minimum} and ${maximum}.`);
    }
  }
  if (bounds.maxResponseBytes > bounds.maxProcessBufferBytes) {
    throw new TypeError('maxResponseBytes cannot exceed maxProcessBufferBytes.');
  }
  return Object.freeze(bounds);
}

function normaliseLabel(value) {
  if (typeof value !== 'string'
    || !value.trim()
    || value.length > 120
    || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new TypeError('Canonical staging runtime operationLabel is invalid.');
  }
  return value.trim();
}

function normaliseTempPrefix(value) {
  if (typeof value !== 'string'
    || value.length > 80
    || !/^[a-z0-9][a-z0-9._-]*-$/.test(value)) {
    throw new TypeError('Canonical staging runtime tempPrefix is invalid.');
  }
  return value;
}

function redactDiagnostic(output, fallback, maxChars) {
  const lines = String(output || '').split('\n').map((line) => line.trim()).filter(Boolean);
  const line = lines.find((item) => /(?:ERROR|DETAIL|HINT):/i.test(item)) || lines.at(-1);
  if (!line) return fallback;
  return line
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-database-url]')
    .replace(
      /((?:password|token|secret|api[_-]?key|service[_-]?role[_-]?key)\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
      '$1[redacted]',
    )
    .slice(0, maxChars);
}

function parseRows(stdout, operationLabel) {
  let payload;
  try {
    payload = JSON.parse(stdout);
  } catch {
    throw new Error(`${operationLabel} returned invalid JSON.`);
  }
  if (!payload || !Array.isArray(payload.rows)) {
    throw new Error(`${operationLabel} returned no rows array.`);
  }
  return payload.rows;
}

export function createCanonicalV2StagingRuntime({
  root,
  tempPrefix = 'canonical-v2-staging-runtime-',
  operationLabel = 'Canonical v2 staging operation',
  bounds: boundOverrides = {},
} = {}) {
  if (typeof root !== 'string' || !root) {
    throw new TypeError('Canonical staging runtime root is required.');
  }
  const repositoryRoot = realpathSync(resolve(root));
  const governedTempPrefix = normaliseTempPrefix(tempPrefix);
  const governedOperationLabel = normaliseLabel(operationLabel);
  const bounds = normaliseBounds(boundOverrides);

  function guardProject() {
    const ref = readFileSync(
      join(repositoryRoot, 'supabase', '.temp', 'project-ref'),
      'utf8',
    ).trim();
    const linked = JSON.parse(readFileSync(
      join(repositoryRoot, 'supabase', '.temp', 'linked-project.json'),
      'utf8',
    ));
    if (ref !== CANONICAL_V2_STAGING_PROJECT.ref
      || linked.ref !== CANONICAL_V2_STAGING_PROJECT.ref
      || linked.name !== CANONICAL_V2_STAGING_PROJECT.name) {
      throw new Error(
        `Refusing to run outside ${CANONICAL_V2_STAGING_PROJECT.name} `
        + `(${CANONICAL_V2_STAGING_PROJECT.ref}).`,
      );
    }
    return CANONICAL_V2_STAGING_PROJECT;
  }

  function safeDiagnostic(output) {
    return redactDiagnostic(
      output,
      `${governedOperationLabel} failed.`,
      bounds.maxDiagnosticChars,
    );
  }

  function sqlJson(value) {
    let json;
    try {
      json = JSON.stringify(value);
    } catch {
      throw new TypeError('Canonical staging JSON value is not serialisable.');
    }
    if (typeof json !== 'string') {
      throw new TypeError('Canonical staging JSON value is not serialisable.');
    }
    const tag = `$canonical_v2_${createHash('sha256').update(json).digest('hex').slice(0, 16)}$`;
    if (json.includes(tag)) {
      throw new TypeError('Unable to construct a safe canonical JSON literal.');
    }
    return `${tag}${json}${tag}::jsonb`;
  }

  function sqlText(value) {
    if (typeof value !== 'string') {
      throw new TypeError('Canonical staging SQL text value must be a string.');
    }
    return `'${value.replaceAll("'", "''")}'`;
  }

  function runSql(sql, { commit = false, readOnly = false } = {}) {
    if (typeof sql !== 'string' || !sql.trim()) {
      throw new TypeError('Canonical staging SQL must be a non-empty string.');
    }
    if (typeof commit !== 'boolean' || typeof readOnly !== 'boolean') {
      throw new TypeError('Canonical staging transaction options must be boolean.');
    }
    if (commit && readOnly) {
      throw new TypeError('A canonical staging read-only transaction cannot request commit.');
    }
    if (Buffer.byteLength(sql, 'utf8') > bounds.maxSqlBytes) {
      throw new Error(`${governedOperationLabel} SQL exceeded its bounded request limit.`);
    }

    guardProject();
    const directory = mkdtempSync(join(tmpdir(), governedTempPrefix));
    const file = join(directory, commit ? 'commit.sql' : 'rollback.sql');
    writeFileSync(file, `BEGIN${readOnly ? ' TRANSACTION READ ONLY' : ''};
SET LOCAL statement_timeout='${bounds.statementTimeoutMs}ms';
${sql}
${commit ? 'COMMIT;' : 'ROLLBACK;'}
`, { mode: 0o600 });
    try {
      const result = spawnSync(
        'supabase',
        [
          '--workdir',
          repositoryRoot,
          'db',
          'query',
          '--linked',
          '--file',
          file,
          '--output',
          'json',
        ],
        {
          cwd: repositoryRoot,
          encoding: 'utf8',
          timeout: bounds.processTimeoutMs,
          maxBuffer: bounds.maxProcessBufferBytes,
          shell: false,
        },
      );
      if (result.error || result.status !== 0) {
        throw new Error(safeDiagnostic(`${result.stderr || ''}\n${result.stdout || ''}`));
      }
      if (Buffer.byteLength(result.stdout || '', 'utf8') > bounds.maxResponseBytes) {
        throw new Error(`${governedOperationLabel} exceeded its bounded response limit.`);
      }
      return parseRows(result.stdout, governedOperationLabel);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }

  function requireStaging(params) {
    if (!params || params.p_environment !== 'staging') {
      throw new TypeError('Canonical runtime RPC environment must be staging.');
    }
  }

  function sqlRpcClient({ commit = false } = {}) {
    if (typeof commit !== 'boolean') {
      throw new TypeError('Canonical runtime RPC commit option must be boolean.');
    }
    return Object.freeze({
      rpc(name, params = {}) {
        let call;
        try {
          requireStaging(params);
          if (name === 'canonical_v2_select_candidate_inputs') {
            call = `public.canonical_v2_select_candidate_inputs(
              'staging',
              ${sqlText(params.p_contract_fingerprint)}
            )`;
          } else if (name === 'canonical_v2_recheck_candidate_input_head') {
            call = `public.canonical_v2_recheck_candidate_input_head(
              'staging',
              ${sqlText(params.p_contract_fingerprint)},
              ${sqlText(params.p_expected_candidate_input_head_id)},
              ${sqlText(params.p_expected_candidate_input_head_payload_digest)}
            )`;
          } else if (name === 'canonical_v2_write') {
            call = `public.canonical_v2_write(
              'staging',
              ${sqlText(params.p_operation)},
              ${sqlText(params.p_idempotency_key)},
              ${sqlText(params.p_input_digest)},
              ${sqlJson(params.p_write_set)},
              ${sqlJson(params.p_residuals)},
              ${sqlJson(params.p_quarantines)},
              ${sqlJson(params.p_receipt)}
            )`;
          } else if (name === 'canonical_v2_import_candidate_release') {
            call = `public.canonical_v2_import_candidate_release(
              'staging',
              ${sqlJson(params.p_import_plan)}
            )`;
          } else if (name === 'canonical_v2_rollback_inactive_candidate_release') {
            call = `public.canonical_v2_rollback_inactive_candidate_release(
              'staging',
              ${sqlText(params.p_candidate_manifest_id)},
              ${sqlText(params.p_corpus_release_id)},
              ${sqlText(params.p_serving_namespace_id)},
              ${sqlText(params.p_candidate_release_import_plan_id)}
            )`;
          } else {
            return Promise.resolve({
              data: null,
              error: { message: 'Unsupported canonical staging RPC.' },
            });
          }
          const rows = runSql(`SELECT ${call} AS result;`, { commit });
          if (rows.length !== 1 || !Object.hasOwn(rows[0], 'result')) {
            throw new Error(`${governedOperationLabel} RPC returned an invalid row set.`);
          }
          return Promise.resolve({ data: rows[0].result, error: null });
        } catch (error) {
          return Promise.resolve({
            data: null,
            error: {
              message: error instanceof Error
                ? error.message
                : `${governedOperationLabel} RPC failed.`,
            },
          });
        }
      },
    });
  }

  return Object.freeze({
    bounds,
    project: CANONICAL_V2_STAGING_PROJECT,
    root: repositoryRoot,
    guardProject,
    runSql,
    safeDiagnostic,
    sqlJson,
    sqlRpcClient,
    sqlText,
  });
}
