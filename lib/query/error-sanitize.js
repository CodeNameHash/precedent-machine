// D (query error surfaces, QA wave 3): two distinct failure modes used to
// leak raw technical text straight into the results area as if it were a
// normal error message:
//
//   1. A garbage/corrupted ?payload= (bad base64, truncated, hand-edited
//      URL) makes JSON.parse throw inside decodePayload() -- the raw
//      SyntaxError message ("Unexpected token '�', "..." is not valid
//      JSON") is genuinely unreadable to anyone but a developer.
//   2. When Supabase itself is degraded (the Cloudflare 522 incident this
//      wave was born from), an upstream error can come back as an HTML
//      error page instead of JSON; whichever layer stringifies that ends up
//      dumping raw "<html>...<title>522...</title>..." markup into the
//      error text.
//
// Both the API route (pages/api/query/run.js, so a non-browser API caller
// also gets a sane message) and the results page (pages/query/[kind]/[id].js,
// belt-and-suspenders for any error string that slips through some other
// path) run every error message through this before display.
//
// No Node builtins here (no Buffer, no fs) so this loads fine in either a
// server (CommonJS require) or browser (webpack) bundle.

const INVALID_LINK_RE = /is not valid JSON|Unexpected token|Unexpected end of JSON input|invalid character|base64/i;
const HTML_GARBAGE_RE = /<\s*html[\s>]|<\s*!doctype|<\s*body[\s>]|cloudflare|error\s*code\s*5\d\d/i;

// Detects "this doesn't even look like a message meant for a human" —
// binary/mojibake noise (replacement characters, high concentration of
// control chars) that can come out of trying to stringify a corrupted byte
// stream. Deliberately conservative: only flips on an actual replacement
// character or a very low printable-ASCII ratio over a reasonably long
// string, so a normal (if unfamiliar) error sentence never triggers it.
function looksLikeGarbageBytes(message) {
  if (!message || message.length < 8) return false;
  if (message.includes('�')) return true;
  const printable = message.replace(/[^\x20-\x7E]/g, '').length;
  return message.length > 20 && printable / message.length < 0.6;
}

// Returns a safe-to-render string for a query/API error message. Pass the
// raw `err.message` (or `json.error`) in; get back either the same message
// unchanged (legitimate validation errors like "field_path does not
// resolve: ..." stay exactly as they are -- they're actionable) or a
// friendly replacement.
function sanitizeQueryError(message) {
  const text = message === null || message === undefined ? '' : String(message);
  if (!text) return 'Something went wrong running this query — try again.';
  if (HTML_GARBAGE_RE.test(text)) return 'The corpus database timed out — try again.';
  if (INVALID_LINK_RE.test(text) || looksLikeGarbageBytes(text)) return 'This query link is invalid.';
  return text;
}

module.exports = { sanitizeQueryError };
