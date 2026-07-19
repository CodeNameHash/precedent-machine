// Registry version bump for docs/schema-shape/normalized-v1.json's
// `_meta.version`. WP-4 delta item 3
// (docs/handoffs/M4-M5-RECONCILED-PLAN-2026-07-18.md, "5. WP-4 (M4-01)") —
// pages/api/admin/reconcile/decide.js bumps this on every write; WP-3's
// per-cell `_prov.registry_version` provenance badge reads it later.
//
// Kept small and pure/testable on purpose: no filesystem access here, just
// string -> string.

const BASE_VERSION = 'normalized-v1.0';
const VERSION_RE = /^normalized-v1\.(\d+)$/;

// Returns the next version string. Unrecognized/missing input restarts at
// BASE_VERSION rather than throwing — a corrupt or pre-versioning `_meta`
// should not block a reconcile decision from writing.
function bumpVersion(current) {
  const match = typeof current === 'string' ? current.match(VERSION_RE) : null;
  if (!match) return BASE_VERSION;
  const next = Number.parseInt(match[1], 10) + 1;
  return `normalized-v1.${next}`;
}

module.exports = { BASE_VERSION, bumpVersion };
