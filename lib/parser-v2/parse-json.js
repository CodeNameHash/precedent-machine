/* ─────────────────────────────────────────────────────────────────────────
   lib/parser-v2/parse-json.js — prose-tolerant JSON extractor.
   ───────────────────────────────────────────────────────────────────────────
   The pipeline reads model responses with `resp.content.map(c => c.text).join('')`
   and parses them as JSON. The Anthropic API backend returns clean JSON, but the
   subscription CLI backend (`claude -p`) sometimes wraps or trails the JSON with
   reasoning prose, markdown fences, or cuts the response off mid-object. A bare
   `JSON.parse` then throws, the chunk is dropped, and extraction silently
   degrades.

   parseJSON is a single, shared extractor that tolerates all four observed
   failure shapes while leaving the clean-JSON path byte-identical to a plain
   `JSON.parse`:
     (a) valid JSON followed by trailing prose
     (b) prose preamble followed by JSON
     (c) markdown ```json / ``` fences
     (d) truncated JSON (response cut off mid-object) — light repair

   Contract: returns the parsed value, or `null` on unrecoverable input (never
   throws), matching the previous helpers' fallback so existing caller error
   handling still works.
   ───────────────────────────────────────────────────────────────────────── */

// Distinct sentinel so a legitimately-parsed JSON `null` is not confused with
// "could not parse".
const NO_PARSE = Symbol('no-parse');

function tryParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return NO_PARSE;
  }
}

// Strip a leading ```json / ``` fence and a trailing ``` fence. Conservative:
// only removes fences at the very start/end so backticks inside JSON string
// values are never corrupted. Prose-embedded fenced JSON is still handled by
// the balanced scan below.
function stripFences(s) {
  let t = s.trim();
  t = t.replace(/^```(?:json)?[ \t]*\r?\n?/i, '');
  t = t.replace(/\r?\n?```[ \t]*$/, '');
  return t.trim();
}

// Scan `s` from `from`, find the first `{` or `[`, then walk forward tracking
// brace/bracket depth while respecting string literals and escapes. Returns the
// outermost balanced span. If EOF is reached while still open, returns the span
// to EOF flagged `truncated` (candidate for repair).
//
// Returns null if no opening bracket exists at/after `from`.
function extractBalanced(s, from = 0) {
  let startIdx = -1;
  for (let i = from; i < s.length; i++) {
    if (s[i] === '{' || s[i] === '[') {
      startIdx = i;
      break;
    }
  }
  if (startIdx === -1) return null;

  const stack = [];
  let inString = false;
  let escaped = false;

  for (let i = startIdx; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === '{' || ch === '[') {
      stack.push(ch);
    } else if (ch === '}' || ch === ']') {
      stack.pop();
      if (stack.length === 0) {
        return { text: s.slice(startIdx, i + 1), startIndex: startIdx, truncated: false };
      }
    }
  }

  // Reached EOF still unbalanced → truncated.
  return { text: s.slice(startIdx), startIndex: startIdx, truncated: true };
}

// Re-scan `s` to learn the open-structure stack and whether it ends mid-string.
function analyze(s) {
  const stack = [];
  let inString = false;
  let escaped = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{' || ch === '[') stack.push(ch);
    else if (ch === '}' || ch === ']') stack.pop();
  }
  return { stack, inString };
}

// Given a (possibly incomplete) balanced-scan prefix that ends outside any
// string, strip a dangling trailing comma or a value-less `"key":` and append
// the closers needed to balance the open structures. Returns the closed string,
// or null if the prefix ends mid-string or has nothing open to close.
function closeCandidate(s) {
  const { stack, inString } = analyze(s);
  if (inString || stack.length === 0) return null;

  let t = s.replace(/\s+$/, '');
  // Drop a trailing comma, then a value-less `"key":`, then any comma it exposes.
  t = t.replace(/,\s*$/, '');
  t = t.replace(/"(?:[^"\\]|\\.)*"\s*:\s*$/, '');
  t = t.replace(/,\s*$/, '');

  let closers = '';
  for (let i = stack.length - 1; i >= 0; i--) {
    closers += stack[i] === '{' ? '}' : ']';
  }
  return t + closers;
}

// Light repair of a truncated balanced span. First tries to close the whole
// span; if that fails (e.g. it was cut mid-string or mid-token), walks back to
// the previous plausible value boundary and retries. Returns the parsed value
// or NO_PARSE.
function repairTruncated(fullText) {
  const direct = closeCandidate(fullText);
  if (direct != null) {
    const parsed = tryParse(direct);
    if (parsed !== NO_PARSE) return parsed;
  }

  // Value boundaries: end of object/array, end of string, digit, or the last
  // char of true/false/null.
  const isBoundary = (ch) =>
    ch === '}' || ch === ']' || ch === '"' || (ch >= '0' && ch <= '9') || ch === 'e' || ch === 'l';

  for (let end = fullText.length - 1; end > 0; end--) {
    if (!isBoundary(fullText[end])) continue;
    const candidate = closeCandidate(fullText.slice(0, end + 1));
    if (candidate == null) continue;
    const parsed = tryParse(candidate);
    if (parsed !== NO_PARSE) return parsed;
  }
  return NO_PARSE;
}

/**
 * Parse a model response into JSON, tolerating fences and surrounding prose.
 *
 * @param {string} raw - Raw text (already joined from response content blocks).
 * @returns {*} Parsed JSON value, or null if unrecoverable.
 */
function parseJSON(raw) {
  if (raw == null) return null;
  const stripped = stripFences(String(raw));

  // 1. Clean-JSON fast path — identical result to a plain JSON.parse.
  const direct = tryParse(stripped);
  if (direct !== NO_PARSE) return direct;

  // 2. Prose-surrounded JSON: take the outermost balanced object/array. Try each
  //    opening bracket in turn so a stray `{` in a prose preamble doesn't block
  //    the real payload that follows.
  let searchFrom = 0;
  while (searchFrom < stripped.length) {
    const span = extractBalanced(stripped, searchFrom);
    if (!span) break;

    const parsed = tryParse(span.text);
    if (parsed !== NO_PARSE) return parsed;

    // 3. Truncation repair on the (unbalanced) EOF span.
    if (span.truncated) {
      const repaired = repairTruncated(span.text);
      if (repaired !== NO_PARSE) return repaired;
    }

    searchFrom = span.startIndex + 1;
  }

  // 4. Unrecoverable. Log a diagnostic (truncation is visible in Vercel logs
  //    without leaking the whole response), return null.
  const tail = stripped.slice(-200);
  console.warn(
    `[parser-v2/parse-json] JSON parse failed (raw length=${stripped.length}, last 200 chars: ${JSON.stringify(tail)})`,
  );
  return null;
}

module.exports = { parseJSON };
