/* ─────────────────────────────────────────────────────────────────────────
   lib/parser-v2/snapshot.js — the classified-sections snapshot, one shape.
   ───────────────────────────────────────────────────────────────────────────
   `deals.metadata.classified_sections` is the cache that makes partial
   re-processing possible: it captures the parse+classify output at ingest
   time so a later per-type re-extract (run-extract.js, scripts/reprocess.js)
   can skip fetch → parse → classify entirely.

   Before this module the compact shape lived inline in TWO places
   (pages/api/ingest/classify.js writes it, lib/parser-v2/run-extract.js
   reads it) and scripts/ingest-local.js never wrote it at all. Everything
   snapshot-shaped now goes through here:

     • toCompactSections()             — classify output → persisted shape
     • sectionsForExtractFromSnapshot()— persisted shape → extract input
     • buildPriorLookup()              — snapshot → cache Map for re-classify
                                         (AI only for sections whose text
                                         changed or was never classified)
     • diffClassifications()           — old vs new snapshot, per-section
                                         type/code delta report

   Pure CJS, no I/O — unit-testable, requireable from API routes and scripts.
   ───────────────────────────────────────────────────────────────────────── */

const crypto = require('crypto');

/**
 * Normalize section text for identity comparison across text bases: strip
 * [[MARKER]] display wrappers and «italic» markers, collapse whitespace,
 * lowercase. The same section parsed from raw-fetched text vs from stored
 * display text must hash identically or the re-classify cache misses.
 */
function normalizeSectionText(text) {
  return String(text || '')
    .replace(/\[\[\/?[A-Z_]+\]\]/g, ' ')
    .replace(/[«»]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Stable 12-hex-char identity hash of a section's (normalized) text. */
function sectionTextHash(text) {
  return crypto.createHash('sha1').update(normalizeSectionText(text)).digest('hex').slice(0, 12);
}

/**
 * Classified sections (classify.js output, either `provision_type` or
 * `provisionType` spelled) → the compact shape persisted on
 * deals.metadata.classified_sections. Mirrors what
 * pages/api/ingest/classify.js has always written.
 */
function toCompactSections(sectionsForExtract) {
  return (sectionsForExtract || []).map((s) => ({
    sectionId: `section-${s.startChar ?? s.start ?? 0}`,
    type: s.provision_type || s.provisionType || null,
    code: s.provisionCode || null,
    text: s.text || s.body || '',
    startChar: typeof s.startChar === 'number' ? s.startChar : (s.start || 0),
    sectionNumber: s.number || s.sectionNumber || null,
    title: s.title || s.heading || null,
    articleType: s.articleType || null,
    confidence: s.confidence || null,
    classifiedBy: s.classifiedBy || null,
  }));
}

/**
 * Persisted compact shape → the section shape extractProvisionsForType
 * expects. Mirrors the mapping that lived inline in run-extract.js.
 */
function sectionsForExtractFromSnapshot(classified) {
  return (classified || []).map((s) => ({
    text: s.text || '',
    body: s.text || '',
    startChar: typeof s.startChar === 'number' ? s.startChar : 0,
    start: typeof s.startChar === 'number' ? s.startChar : 0,
    number: s.sectionNumber || null,
    sectionNumber: s.sectionNumber || null,
    title: s.title || null,
    heading: s.title || null,
    articleType: s.articleType || null,
    provision_type: s.type || null,
    provisionType: s.type || null,
    provisionCode: s.code || null,
  }));
}

/**
 * Snapshot → Map(textHash → { provisionType, provisionCode, confidence }).
 * classifySections consults this BEFORE calling the AI: a section whose
 * normalized text matches a previously-classified section reuses that
 * result (classifiedBy: 'cache'), so a classify-rule tweak only pays AI
 * cost for sections the deterministic pass leaves open AND the cache has
 * never seen. Deterministic rules still run first and win — rule changes
 * take effect immediately.
 */
function buildPriorLookup(compactSections) {
  const prior = new Map();
  for (const s of compactSections || []) {
    if (!s || !s.type) continue;
    const hash = sectionTextHash(s.text);
    if (!prior.has(hash)) {
      prior.set(hash, {
        provisionType: s.type,
        provisionCode: s.code || null,
        confidence: s.confidence || 'medium',
      });
    }
  }
  return prior;
}

/** by-type breakdown of a compact snapshot ({ TYPE: count }). */
function classifyBreakdown(compactSections) {
  const byType = {};
  for (const s of compactSections || []) {
    const t = (s && s.type) || 'OTHER';
    byType[t] = (byType[t] || 0) + 1;
  }
  return byType;
}

/**
 * Diff two compact snapshots (before vs after a re-classify).
 * Sections pair up by sectionNumber when it is unique on both sides,
 * then by normalized-text hash (survives re-parses where offsets shift,
 * e.g. raw-text-based vs display-text-based parses of the same deal).
 * Returns { changed, added, removed, unchanged } where `changed` rows carry
 * { sectionNumber, title, from, to, fromCode, toCode }.
 */
function diffClassifications(before, after) {
  const b = (before || []).slice();
  const a = (after || []).slice();

  const uniqueIndex = (rows, keyFn) => {
    const counts = new Map();
    for (const r of rows) {
      const k = keyFn(r);
      if (k) counts.set(k, (counts.get(k) || 0) + 1);
    }
    const m = new Map();
    for (const r of rows) {
      const k = keyFn(r);
      if (k && counts.get(k) === 1) m.set(k, r);
    }
    return m;
  };

  const pairs = [];
  const usedB = new Set();
  const usedA = new Set();

  // Pass 1: unique sectionNumber on both sides.
  const bByNum = uniqueIndex(b, (r) => r.sectionNumber);
  const aByNum = uniqueIndex(a, (r) => r.sectionNumber);
  for (const [num, aRow] of aByNum) {
    const bRow = bByNum.get(num);
    if (bRow) {
      pairs.push([bRow, aRow]);
      usedB.add(bRow);
      usedA.add(aRow);
    }
  }

  // Pass 2: unique text hash among the leftovers.
  const bLeft = b.filter((r) => !usedB.has(r));
  const aLeft = a.filter((r) => !usedA.has(r));
  const bByHash = uniqueIndex(bLeft, (r) => sectionTextHash(r.text));
  const aByHash = uniqueIndex(aLeft, (r) => sectionTextHash(r.text));
  for (const [hash, aRow] of aByHash) {
    const bRow = bByHash.get(hash);
    if (bRow) {
      pairs.push([bRow, aRow]);
      usedB.add(bRow);
      usedA.add(aRow);
    }
  }

  const changed = [];
  let unchanged = 0;
  for (const [bRow, aRow] of pairs) {
    if (bRow.type !== aRow.type || (bRow.code || null) !== (aRow.code || null)) {
      changed.push({
        sectionNumber: aRow.sectionNumber || bRow.sectionNumber || null,
        title: aRow.title || bRow.title || null,
        from: bRow.type || null,
        to: aRow.type || null,
        fromCode: bRow.code || null,
        toCode: aRow.code || null,
      });
    } else {
      unchanged += 1;
    }
  }

  const removed = b.filter((r) => !usedB.has(r)).map((r) => ({
    sectionNumber: r.sectionNumber || null, title: r.title || null, type: r.type || null,
  }));
  const added = a.filter((r) => !usedA.has(r)).map((r) => ({
    sectionNumber: r.sectionNumber || null, title: r.title || null, type: r.type || null,
  }));

  return { changed, added, removed, unchanged };
}

module.exports = {
  normalizeSectionText,
  sectionTextHash,
  toCompactSections,
  sectionsForExtractFromSnapshot,
  buildPriorLookup,
  classifyBreakdown,
  diffClassifications,
};
