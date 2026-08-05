#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const SOURCE_PATH = path.join(REPO_ROOT, 'docs/schema-shape/normalized-v1.json');
const TARGET_PATH = path.join(REPO_ROOT, 'lib/query/serving-registry-v1.json');

// lib/query/resolve.js's readRegistry() builds a single alias->entry map by
// walking entries in array order and keeping the FIRST claimant of each
// alias string (including each entry's own `key`, which is unioned into its
// own alias set). That is correct for genuine synonyms, but the source
// registry also carries, for a meaningful minority of entries, an `aliases`
// list that includes ANOTHER entry's canonical `key` -- typically a stale
// cross-reference left over from before two related fields were split into
// distinct entries (see docs/schema-shape/normalized-v1.json _meta's own
// phase0C_reconciliation_notes for confirmed examples), or a
// `rubric.<family>.<snake_case>` shadow-row that duplicates a clean
// camelCase entry's identity. Whichever entry sorts first then permanently
// shadows the other entry's OWN key: a query naming the shadowed field's
// exact canonical key resolves cleanly and silently returns a different
// entry's data. A canonical key must always resolve to itself, independent
// of array order, so that invariant is enforced HERE -- once, structurally,
// on every regeneration -- rather than by hand-patching the generated JSON
// (which the next `npm run generate:query-registry` would silently revert).
//
// This only removes an alias that collides with a DIFFERENT entry's own
// key. It never touches aliases that collide with each other without either
// side being a canonical key -- those are lower-stakes ambiguities (mostly
// mechanical near-duplicates, occasionally a genuine naming collision
// between two distinct concepts) that first-claimant-wins already resolves
// deterministically, and choosing among them is an owner decision, not a
// mechanical one.
function stripCrossEntryKeyShadowing(entries) {
  const canonicalKeys = new Set(entries.map((entry) => entry.key));
  return entries.map((entry) => {
    const aliases = Array.isArray(entry.aliases) ? entry.aliases : [];
    const cleaned = aliases.filter((alias) => alias === entry.key || !canonicalKeys.has(alias));
    if (cleaned.length === aliases.length) return entry;
    return { ...entry, aliases: cleaned };
  });
}

// Registry rows whose declared `type` plainly contradicts the unit named in
// their OWN `displayName` -- not a judgment call about what the field means,
// just the row disagreeing with itself. Each entry here quotes the exact
// contradiction. Left uncorrected: a field whose type is merely arguable
// (e.g. divestitureCap's "(dollar or revenue threshold)" percent, or
// financingCooperation's documented legacy percent/boolean merge --
// see lib/query/types.js's valueFromRaw comment) is reported, not guessed.
const TYPE_CORRECTIONS = Object.freeze({
  // "Tail fee window (months)" declared usd. A duration, not currency.
  tailFeeWindowMonths: 'number',
  // "Fee as Percentage of Deal Value" declared usd. A percentage, not currency.
  feePercentage: 'percent',
  // "Termination fee as % of equity value" declared usd. A percentage, not currency.
  terminationFeePercentEquityValue: 'percent',
  // "Go-Shop Window (calendar days)" declared percent. A duration, not a percentage.
  goShopWindow: 'number',
  // "Reimbursement cap (currency)" declared percent. Currency, not a percentage.
  cap: 'usd',
});

function applyTypeCorrections(entries) {
  return entries.map((entry) => {
    const corrected = TYPE_CORRECTIONS[entry.key];
    if (!corrected || entry.type === corrected) return entry;
    return { ...entry, type: corrected };
  });
}

function buildServingRegistry(source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    throw new TypeError('normalized registry must be an object');
  }
  if (!source._meta || typeof source._meta !== 'object' || Array.isArray(source._meta)) {
    throw new TypeError('normalized registry must contain _meta');
  }
  if (!Array.isArray(source.entries)) {
    throw new TypeError('normalized registry must contain entries');
  }
  const entries = applyTypeCorrections(stripCrossEntryKeyShadowing(source.entries));
  return { _meta: source._meta, entries };
}

function serializeServingRegistry(registry) {
  return `${JSON.stringify(registry, null, 2)}\n`;
}

function generate({ check = false } = {}) {
  const source = JSON.parse(fs.readFileSync(SOURCE_PATH, 'utf8'));
  const output = serializeServingRegistry(buildServingRegistry(source));
  if (check) {
    const current = fs.existsSync(TARGET_PATH) ? fs.readFileSync(TARGET_PATH, 'utf8') : null;
    if (current !== output) {
      throw new Error('Query serving registry is stale. Run npm run generate:query-registry.');
    }
    return { changed: false, bytes: Buffer.byteLength(output), entries: source.entries.length };
  }
  const current = fs.existsSync(TARGET_PATH) ? fs.readFileSync(TARGET_PATH, 'utf8') : null;
  if (current !== output) fs.writeFileSync(TARGET_PATH, output);
  return { changed: current !== output, bytes: Buffer.byteLength(output), entries: source.entries.length };
}

if (require.main === module) {
  try {
    const result = generate({ check: process.argv.includes('--check') });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  SOURCE_PATH,
  TARGET_PATH,
  TYPE_CORRECTIONS,
  applyTypeCorrections,
  buildServingRegistry,
  generate,
  serializeServingRegistry,
  stripCrossEntryKeyShadowing,
};
