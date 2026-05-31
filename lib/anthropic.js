/* ─────────────────────────────────────────────────────────────────────────
   lib/anthropic.js — one Anthropic client + one model constant.
   ───────────────────────────────────────────────────────────────────────────
   Previously `new Anthropic({ apiKey })` was instantiated in 22 files and the
   model id was hardcoded in 23 places. Bumping the model meant a 23-file edit.
   Import { getAnthropic, MODEL } from here instead.

   getAnthropic() returns a client, or null when ANTHROPIC_API_KEY is unset, so
   existing call-site guards (`if (!client) return 500`) keep working.

   cachedSystem() helps opt a large static system prompt into prompt caching:
     system: cachedSystem(BIG_STATIC_PROMPT)
   emits a single text block tagged with cache_control so repeated ingest
   calls reuse the cached prefix (cheaper + faster). Pass a plain string to a
   route that doesn't want caching and nothing changes.
   ───────────────────────────────────────────────────────────────────────── */

import Anthropic from '@anthropic-ai/sdk';
import { MODEL as _MODEL } from './model';

/* Single source of truth for the model id (re-exported from lib/model.js,
 * which is CommonJS so the parser-v2 modules can require it too). */
export const MODEL = _MODEL;

let _client = null;

/* Returns a memoized Anthropic client, or null if the API key is missing.
 * The memo is safe: API routes are stateless and the key never changes within
 * a process lifetime. */
export function getAnthropic() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  if (!_client) _client = new Anthropic({ apiKey });
  return _client;
}

/* Wrap a long, static system prompt in a cache_control-tagged content block so
 * the Anthropic API can reuse it across calls. Returns the array shape the SDK
 * accepts for `system`. */
export function cachedSystem(text) {
  return [{ type: 'text', text: String(text || ''), cache_control: { type: 'ephemeral' } }];
}
