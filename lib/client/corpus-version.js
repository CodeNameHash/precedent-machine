// Client-side corpus-version token (r13, "cache per week and just test if
// there has been an update to the corpus since"). GET /api/corpus-version
// returns a cheap content fingerprint, itself edge-cached 60s; appending it
// as `&v=<version>` to a corpus-stats/corpus-stats-batch request makes that
// URL part of the edge-cache key, so /api/corpus-stats can safely cache the
// response for a week (VERSIONED_CACHE) instead of an hour -- see
// pages/api/corpus-version.js and pages/api/corpus-stats.js's header
// comments for the full design.
//
// Every caller on a page shares ONE in-flight fetch (module-level memoized
// promise) rather than each corpus-stats consumer independently probing
// /api/corpus-version. The fetch always resolves within
// VERSION_FETCH_TIMEOUT_MS -- on failure OR timeout it resolves `null`
// rather than rejecting, so a caller can simply `await` it without its own
// try/catch or race: null just means "proceed tokenless," the same
// unversioned behavior corpus-stats already has today.

const VERSION_FETCH_TIMEOUT_MS = 2000;

let versionPromise = null;

function fetchVersion() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), VERSION_FETCH_TIMEOUT_MS);
  return fetch('/api/corpus-version', { signal: controller.signal })
    .then((r) => (r.ok ? r.json() : null))
    .then((json) => (json && json.version ? String(json.version) : null))
    .catch(() => null)
    .finally(() => clearTimeout(timeoutId));
}

// Promise<string|null> -- the corpus version token, or null when the fetch
// failed or exceeded the cap. Memoized module-wide: the first call kicks off
// the fetch, every call after (this page load) reuses that same promise.
export function getCorpusVersion() {
  if (!versionPromise) versionPromise = fetchVersion();
  return versionPromise;
}

// Test-only escape hatch -- production code never needs to reset the
// module-level memo (one fetch per page load is the whole point), but tests
// that import this module across cases need a clean slate.
export function __resetCorpusVersionForTests() {
  versionPromise = null;
}
