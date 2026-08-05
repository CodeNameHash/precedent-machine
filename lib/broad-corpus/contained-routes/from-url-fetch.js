// lib/broad-corpus/contained-routes/from-url-fetch.js
//
// The SSRF-guarded fetch used by the repaired ingest/from-url.js archive
// (./from-url.js). Split into its own module, with no dependency on
// lib/anthropic.js or the parser-v2 pipeline, specifically so it can be
// unit-tested with plain `node --test` — lib/anthropic.js imports
// `./model` with no extension, which Next's bundler resolves but Node's own
// module resolver does not, so anything that transitively requires it
// cannot be loaded outside Next. That is a pre-existing characteristic of
// this codebase (not introduced here, not an auth-scope fix) and it does
// not affect the live app, only standalone `node --test` runs — see
// tests/auth/critical-routes-repair.test.js for what this buys: the actual
// SSRF fix gets exercised with a real HTTP server, not just read as source.
//
// SEC-repair (S2): the July security review's finding on
// pages/api/ingest/from-url.js was "unauthenticated SSRF — fetches
// attacker-supplied URL server-side, follows redirects with no
// revalidation." This route's only real-world use is SEC EDGAR ingestion
// (see the module doc on ./from-url.js and the grep for sec.gov across
// tests/ and lib/edgar-catalog.js done while building this fix — no other
// host is referenced anywhere in this codebase). fetchUrl() below only
// fetches https://sec.gov and https://*.sec.gov, and re-validates every
// redirect hop against that same allowlist before following it, capped at
// MAX_REDIRECTS hops. The original let a caller hand it *any* URL —
// including internal/private network addresses, cloud metadata endpoints,
// or a URL that looped back into this app's own routes — and followed an
// unbounded chain of redirects wherever the first response pointed,
// unauthenticated.
const https = require('https');
const { fromCp } = require('../../html-entities');

const SEC_UA = process.env.SEC_USER_AGENT || 'Precedent Machine bengoodchild@gmail.com';

const ALLOWED_HOST_SUFFIX = '.sec.gov';
const ALLOWED_EXACT_HOST = 'sec.gov';
const MAX_REDIRECTS = 5;

function isAllowedIngestUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  const host = parsed.hostname.toLowerCase();
  return host === ALLOWED_EXACT_HOST || host.endsWith(ALLOWED_HOST_SUFFIX);
}

function fetchUrl(url, redirectsRemaining = MAX_REDIRECTS, { httpsClient = https } = {}) {
  return new Promise((resolve, reject) => {
    if (!isAllowedIngestUrl(url)) {
      reject(new Error(
        `Refusing to fetch ${url}: only https://sec.gov and https://*.sec.gov URLs are allowed. `
        + 'This route ingests SEC EDGAR filings only — see lib/broad-corpus/contained-routes/from-url-fetch.js.',
      ));
      return;
    }
    const req = httpsClient.get(
      url,
      {
        headers: {
          'User-Agent': SEC_UA,
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'identity',
        },
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          if (redirectsRemaining <= 0) {
            res.resume();
            return reject(new Error(`Too many redirects fetching ${url}`));
          }
          // Resolve relative redirects against the current URL, then
          // re-validate the RESOLVED target — the original bug let a
          // sec.gov response redirect anywhere and followed it unchecked.
          const next = new URL(res.headers.location, url).toString();
          res.resume();
          return fetchUrl(next, redirectsRemaining - 1, { httpsClient }).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(
            new Error(
              `HTTP ${res.statusCode} fetching ${url} — SEC EDGAR requires a User-Agent in the form "Name email@domain". Set the SEC_USER_AGENT env var if you need to override the default.`
            )
          );
        }
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve(data));
      }
    );
    req.on('error', reject);
    req.setTimeout(45000, () => {
      req.destroy();
      reject(new Error('Fetch timeout'));
    });
  });
}

function stripHtml(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/td>/gi, '\t')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&rsquo;/gi, "'")
    .replace(/&ldquo;/gi, '"')
    .replace(/&rdquo;/gi, '"')
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
    .replace(/&(?:lrm|rlm|zwnj|zwj|ZeroWidthSpace|NegativeThinSpace);/g, '')
    .replace(/&(?:ensp|emsp|thinsp|hairsp|numsp|puncsp);/g, ' ')
    .replace(/&sect;/gi, '§')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => fromCp(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => fromCp(parseInt(n, 10)))
    .replace(/[​-‏⁠﻿]/g, '')
    .replace(/\t+/g, ' ')
    .replace(/ +/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

module.exports = {
  SEC_UA,
  ALLOWED_HOST_SUFFIX,
  ALLOWED_EXACT_HOST,
  MAX_REDIRECTS,
  isAllowedIngestUrl,
  fetchUrl,
  stripHtml,
};
