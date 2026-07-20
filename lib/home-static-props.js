// F3: getStaticProps logic for pages/index.js, pulled into a plain
// (non-JSX) module so it's requireable from node:test without a JSX
// transform, and so the fail-soft contract is unit-testable in isolation.
//
// `sbFactory` (a () => SupabaseClient|null function, normally
// getServiceSupabase) is passed in by the caller rather than required here.
// lib/supabase.js only has an ESM `export`, and requiring it via CJS
// `require()` from a lib file resolves to `undefined` under Next's webpack
// build (every pages/api/*.js route instead imports it via ESM `import`) —
// letting the JSX-page caller do that import avoids the trap, and as a
// bonus makes this module trivially testable with a fake client.
const { fetchHomeData } = require('./home-data');

const REVALIDATE_SECONDS = 300;
const BUILD_FETCH_TIMEOUT_MS = 8000;

function withTimeout(promise, timeoutMs) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Home snapshot timed out')), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Must fail soft: this runs at build time in CI where Supabase env may be
// absent (or the deploy environment may have Supabase transiently down).
// Returning empty props + a short revalidate keeps the build green and lets
// the client-side fetch in HomePage fill in on the next request instead of
// failing the build.
async function getHomeStaticProps(sbFactory, { timeoutMs = BUILD_FETCH_TIMEOUT_MS, fetcher = fetchHomeData } = {}) {
  try {
    const sb = sbFactory();
    if (!sb) return { props: { initialData: null }, revalidate: REVALIDATE_SECONDS };
    const payload = await withTimeout(fetcher(sb), timeoutMs);
    return { props: { initialData: payload }, revalidate: REVALIDATE_SECONDS };
  } catch {
    return { props: { initialData: null }, revalidate: REVALIDATE_SECONDS };
  }
}

module.exports = { BUILD_FETCH_TIMEOUT_MS, getHomeStaticProps, REVALIDATE_SECONDS };
