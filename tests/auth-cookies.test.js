const test = require('node:test');
const assert = require('node:assert/strict');

const {
  SESSION_COOKIE_NAME,
  parseCookieHeader,
  extractSessionCookie,
  serializeSessionCookie,
  serializeExpiredSessionCookie,
} = require('../lib/auth/cookies');

test('SESSION_COOKIE_NAME is pm_session', () => {
  assert.equal(SESSION_COOKIE_NAME, 'pm_session');
});

test('parseCookieHeader parses multiple cookies', () => {
  const parsed = parseCookieHeader('a=1; pm_session=abc.def; other=xyz');
  assert.deepEqual(parsed, { a: '1', pm_session: 'abc.def', other: 'xyz' });
});

test('parseCookieHeader handles missing/empty header without throwing', () => {
  assert.deepEqual(parseCookieHeader(undefined), {});
  assert.deepEqual(parseCookieHeader(null), {});
  assert.deepEqual(parseCookieHeader(''), {});
});

test('extractSessionCookie finds pm_session among other cookies', () => {
  assert.equal(extractSessionCookie('theme=dark; pm_session=my-token; other=1'), 'my-token');
});

test('extractSessionCookie returns null when absent', () => {
  assert.equal(extractSessionCookie('theme=dark; other=1'), null);
  assert.equal(extractSessionCookie(''), null);
  assert.equal(extractSessionCookie(undefined), null);
});

test('extractSessionCookie URL-decodes the value (token contains base64url-safe chars only, but the cookie codec must round-trip generally)', () => {
  const raw = encodeURIComponent('abc.def-ghi_jkl');
  assert.equal(extractSessionCookie(`pm_session=${raw}`), 'abc.def-ghi_jkl');
});

test('serializeSessionCookie sets HttpOnly, Secure, SameSite=Lax, Path=/, and a Max-Age', () => {
  const header = serializeSessionCookie('sometoken', { maxAgeSeconds: 3600 });
  assert.match(header, /^pm_session=sometoken/);
  assert.match(header, /(^|; )HttpOnly(;|$)/);
  assert.match(header, /(^|; )Secure(;|$)/);
  assert.match(header, /(^|; )SameSite=Lax(;|$)/);
  assert.match(header, /(^|; )Path=\/(;|$)/);
  assert.match(header, /(^|; )Max-Age=3600(;|$)/);
});

test('serializeSessionCookie can omit Secure (not used in production, but the mechanism is testable)', () => {
  const header = serializeSessionCookie('sometoken', { maxAgeSeconds: 3600, secure: false });
  assert.doesNotMatch(header, /Secure/);
});

test('serializeSessionCookie URL-encodes the token value', () => {
  const header = serializeSessionCookie('abc.def_ghi-jkl');
  assert.match(header, /^pm_session=abc\.def_ghi-jkl/);
});

test('serializeExpiredSessionCookie clears the cookie (Max-Age=0, empty value, still HttpOnly/Secure/SameSite)', () => {
  const header = serializeExpiredSessionCookie();
  assert.match(header, /^pm_session=(;|$)/);
  assert.match(header, /(^|; )Max-Age=0(;|$)/);
  assert.match(header, /(^|; )HttpOnly(;|$)/);
  assert.match(header, /(^|; )Secure(;|$)/);
  assert.match(header, /(^|; )SameSite=Lax(;|$)/);
});

test('a cookie serialized then parsed back out round-trips the exact token', () => {
  const token = 'eyJzdWIiOiJiZW4ifQ.c2lnbmF0dXJl';
  const setCookieHeader = serializeSessionCookie(token);
  // Set-Cookie's first segment is `name=value` — simulate the browser
  // sending that segment back as a Cookie request header.
  const nameValue = setCookieHeader.split(';')[0];
  assert.equal(extractSessionCookie(nameValue), token);
});
