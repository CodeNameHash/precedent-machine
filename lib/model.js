/* ─────────────────────────────────────────────────────────────────────────
   lib/model.js — the single Anthropic model id.
   ───────────────────────────────────────────────────────────────────────────
   CommonJS on purpose: this is consumed by both ESM call sites
   (lib/anthropic.js, API route pages via `import { MODEL }`) and the CommonJS
   parser-v2 modules (lib/parser-v2/*.js via `require`). ESM-importing-CJS works
   in the Next bundler; the reverse does not, so the lowest common denominator
   (CJS) lives here and everything else re-exports / re-requires it.
   ───────────────────────────────────────────────────────────────────────── */

const MODEL = 'claude-sonnet-4-20250514';

module.exports = { MODEL };
