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
  const response = await fetchImpl(url, { headers });
  const body = await response.text();
  let parsed = null;
  try { parsed = JSON.parse(body); } catch { parsed = null; }
  return {
    status: response.status,
    headers: response.headers,
    seconds: (Date.now() - started) / 1000,
    bytes: Buffer.byteLength(body, 'utf8'),
    body: parsed,
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
    const payload = read.body || {};
    const sections = (payload.analysis?.sections || []).length;
    const facts = (payload.analysis?.proposals || []).length;
    const withoutFacts = (payload.sections_without_facts || []).map((entry) => ({
      section_reference: entry.section_reference,
      reason: entry.reason,
      families: entry.families || [],
    }));
    let second = null;
    if (read.status === 200) {
      const again = await getJson(fetchImpl, `${base}/api/product/analysis/${encodeURIComponent(run)}/preview`, headers);
      second = { status: again.status, seconds: again.seconds, model: again.headers?.get?.('x-preview-read') || null };
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
      bytes: read.bytes,
      seconds: read.seconds,
      model: read.headers?.get?.('x-preview-read') || null,
      sections,
      facts,
      withoutFacts,
      second,
      runRead,
    });
  }
  return report;
}

function renderPreviewChecks(report) {
  const lines = [];
  for (const entry of report) {
    if (entry.error) { lines.push(`${entry.run}: ${entry.error}`); continue; }
    lines.push(`${entry.run}: preview ${entry.status} ${entry.bytes} bytes in ${entry.seconds.toFixed(1)}s`
      + ` (sections ${entry.sections}, facts ${entry.facts}) X-Preview-Read=${entry.model || '(live)'}`);
    if (entry.status !== 200) { lines.push('  the read was refused: check the credential and the bypass secret.'); continue; }
    if (entry.withoutFacts.length === 0) lines.push('  sections with no facts: none');
    else for (const row of entry.withoutFacts) lines.push(`  section with no facts: ${row.section_reference} — ${row.reason}${row.families.length ? ` (${row.families.join(', ')})` : ''}`);
    if (entry.second) lines.push(`  second read: ${entry.second.status} in ${entry.second.seconds.toFixed(1)}s X-Preview-Read=${entry.second.model || '(live)'}`);
    if (entry.runRead) lines.push(`  run read: ${entry.runRead.status} in ${entry.runRead.seconds.toFixed(1)}s`);
  }
  return lines.join('\n');
}

module.exports = { DEFAULT_BASE_URL, headersFor, runPreviewChecks, renderPreviewChecks };
