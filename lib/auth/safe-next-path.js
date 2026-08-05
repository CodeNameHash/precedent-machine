// lib/auth/safe-next-path.js
//
// Guards pages/login.js's post-login redirect against becoming an open
// redirect. `next` comes back off the URL (middleware.js sets it, from the
// path it refused, onto the /login redirect it sends) — treat it as
// untrusted input from here on, the same as any other query parameter.
// Pulled into its own module (rather than staying a private function inside
// the page component) specifically so it can be unit-tested directly; see
// tests/auth-safe-next-path.test.js.
function safeNextPath(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return '/';
  // Must be an app-relative path ("/review/xyz"), which rules out absolute
  // URLs ("https://evil.com"). Must not start with "//" or "/\", which
  // browsers resolve as scheme-relative ("//evil.com" behaves like
  // "https://evil.com" against the current scheme) — a classic open-redirect
  // bypass of a naive `startsWith('/')` check.
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return '/';
  return raw;
}

module.exports = { safeNextPath };
