'use strict';

// The four live checks of a deployed preview (work packages 46 and 47, plan
// findings (264) and (265)), as a function a script and a test can both use.
//
//   - the lawyer preview read of a run: status, size, time and the
//     X-Preview-Read header (MODEL once the read model of finding (251) is
//     serving, absent on the live read);
//   - `sections_without_facts` from that payload: the sections the page
//     names as having produced no fact at all (finding (246));
//   - a second read of the same run, to see whether the projection is
//     served from the stored model;
//   - the run analysis read, timed.
//
// The credential is either PRODUCT_INTERNAL_TOKEN as `Authorization: Bearer`
// or a `pm_session` cookie value as `Cookie: pm_session=...`; the
// Deployment Protection bypass, when the deployment has protection on, goes
// as `x-vercel-protection-bypass`. Nothing is logged but statuses, sizes,
// timings and section references — never the credential.

const { previewFactsFromWorkspace } = require('./provisions-preview');

const DEFAULT_BASE_URL = 'https://deal-corpus-preview.vercel.app';

function headersFor({ token = null, bypass = null }) {
  const headers = {};
  if (bypass) headers['x-vercel-protection-bypass'] = bypass;
  if (token) {
    if (/^pm_session=/.test(token)) headers.cookie = token;
    else {
      headers.authorization = `Bearer ${token}`;
      // A browser session value without the cookie name still works as a
      // cookie when it looks like a session token (three dot-separated
      // parts, the shape lib/auth/session.js issues).
      if (token.split('.').length === 3) headers.cookie = `pm_session=${token}`;
    }
  }
  return headers;
}

async function getJson(fetchImpl, url, headers) {
  const started = Date.now();
  // A manual redirect is not a read: the first version followed a login
  // redirect and reported the login page's HTML as a 200 preview (the
  // review of 2026-10-25, finding 3).
  const response = await fetchImpl(url, { headers, redirect: 'manual' });
  const body = await response.text();
  let parsed = null;
  try { parsed = JSON.parse(body); } catch { parsed = null; }
  return {
    status: response.status,
    location: response.headers?.get?.('location') || null,
    headers: response.headers,
    seconds: (Date.now() - started) / 1000,
    bytes: Buffer.byteLength(body, 'utf8'),
    body: parsed,
    json: parsed !== null,
  };
}

async function runPreviewChecks({ baseUrl = DEFAULT_BASE_URL, token = null, bypass = null, runs = [], fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('a fetch implementation is required');
  if (!token) throw new TypeError('a token or session value is required');
  if (!Array.isArray(runs) || runs.length === 0) throw new TypeError('at least one run id is required');
  const headers = headersFor({ token, bypass });
  const base = String(baseUrl).replace(/\/+$/, '');
  const report = [];
  for (const run of runs) {
    let read;
    try {
      read = await getJson(fetchImpl, `${base}/api/product/analysis/${encodeURIComponent(run)}/preview`, headers);
    } catch (error) {
      report.push({ run, error: String(error?.message || error) });
      continue;
    }
    // Only a 200 that is the preview workspace counts as a read: a redirect
    // (3xx) or an HTML 200 that is not the workspace is refused, not
    // reported as a page with no sections.
    const workspace = read.status === 200 && Boolean(read.body && read.body.schema_version === 'PRODUCT_PREVIEW_WORKSPACE/V2');
    const payload = workspace ? read.body : {};
    const sections = (payload.analysis?.sections || []).length;
    const facts = (payload.analysis?.proposals || []).length;
    // `sections_without_facts` is not a field of the preview payload: the
    // page computes it with previewFactsFromWorkspace over that payload
    // (work package 33), so the check computes it the same way. Reading a
    // field of that name answered "none" for a run that has two (the first
    // version of this check did, 2026-10-25).
    let withoutFacts = [];
    let projectionError = null;
    if (workspace) {
      try {
        withoutFacts = previewFactsFromWorkspace(payload).sections_without_facts.map((entry) => ({
          section_reference: entry.section_reference,
          reason: entry.reason,
          families: entry.families || [],
        }));
      } catch (error) {
        projectionError = String(error?.message || error);
      }
    }
    let second = null;
    if (workspace) {
      try {
        const again = await getJson(fetchImpl, `${base}/api/product/analysis/${encodeURIComponent(run)}/preview`, headers);
        second = { status: again.status, seconds: again.seconds, model: again.headers?.get?.('x-preview-read') || null };
      } catch (error) {
        // One flaky second read must not lose the report of every other run.
        second = { status: null, seconds: null, model: null, error: String(error?.message || error) };
      }
    }
    let runRead = null;
    try {
      const status = await getJson(fetchImpl, `${base}/api/product/analysis/${encodeURIComponent(run)}`, headers);
      runRead = { status: status.status, seconds: status.seconds };
    } catch (error) {
      runRead = { status: null, error: String(error?.message || error) };
    }
    report.push({
      run,
      status: read.status,
      workspace,
      location: read.location,
      bytes: read.bytes,
      seconds: read.seconds,
      model: read.headers?.get?.('x-preview-read') || null,
      sections,
      facts,
      withoutFacts,
      projectionError,
      second,
      runRead,
    });
  }
  return report;
}

// What a refusal most likely means, by status (the first version said
// "credential and bypass" for every one, including a 500).
function refusalHint(status) {
  if (status === 401 || status === 403) return 'check the credential and the bypass secret.';
  if (status === 404) return 'the run was not found, or this credential has no access to it.';
  if (status >= 500) return 'the deployment failed the read; check its logs.';
  return `status ${status}; check the URL, the run id and the deployment.`;
}

function renderPreviewChecks(report) {
  const lines = [];
  for (const entry of report) {
    if (entry.error) { lines.push(`${entry.run}: ${entry.error}`); continue; }
    lines.push(`${entry.run}: preview ${entry.status} ${entry.bytes} bytes in ${entry.seconds.toFixed(1)}s`
      + ` (sections ${entry.sections}, facts ${entry.facts}) X-Preview-Read=${entry.model || '(live)'}`);
    if (entry.status !== 200) { lines.push(`  the read was refused: ${refusalHint(entry.status)}`); continue; }
    if (!entry.workspace) {
      lines.push(`  the answer was not the preview workspace (${entry.status}${entry.location ? `, redirect to ${entry.location}` : ''}); a redirect or an error page, not a read.`);
      continue;
    }
    if (entry.projectionError) lines.push(`  the payload could not be projected: ${entry.projectionError}`);
    if (entry.withoutFacts.length === 0) lines.push('  sections with no facts: none');
    else for (const row of entry.withoutFacts) lines.push(`  section with no facts: ${row.section_reference} — ${row.reason}${row.families.length ? ` (${row.families.join(', ')})` : ''}`);
    if (entry.second?.error) lines.push(`  second read failed: ${entry.second.error}`);
    else if (entry.second) lines.push(`  second read: ${entry.second.status} in ${entry.second.seconds.toFixed(1)}s X-Preview-Read=${entry.second.model || '(live)'}`);
    if (entry.runRead) lines.push(`  run read: ${entry.runRead.status} in ${entry.runRead.seconds.toFixed(1)}s`);
  }
  return lines.join('\n');
}

module.exports = { DEFAULT_BASE_URL, headersFor, runPreviewChecks, renderPreviewChecks };
