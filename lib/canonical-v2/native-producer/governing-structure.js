/**
 * lib/canonical-v2/native-producer/governing-structure.js
 *
 * Step 2X-A structure-context service.
 *
 * `resolveGoverningStructure({ sectionText, startByte, endByte })` answers
 * "what governs this UTF-8 byte span inside this section?" by containment
 * over `segmentSubClauses` leaves. Returns either a RESOLVED leaf plus its
 * chapeau chain (UTF-8 bytes), or a typed UNDETERMINED. Never a guess.
 *
 * Segmentation stays in UTF-16 string indices inside `subclauses.js`. This
 * module converts at the boundary via `utf8ByteLength` / `utf8Slice`.
 * `subclauses.js` is not ported to bytes (V1 consumers must stay
 * byte-identical on their fixtures).
 *
 * Fail-closed reasons (typed UNDETERMINED):
 *   - SPAN_OUTSIDE_TEXT
 *   - SPAN_CROSSES_LEAVES
 *   - SAME_STYLE_CHAIN (mis-nest signature — mandatory refusal)
 *   - AMBIGUOUS_OUTLINE (reserved; not guessed away)
 *
 * Markerless sections: a single null-marker leaf covering the section is
 * RESOLVED as section-only context (the honest floor), not UNDETERMINED.
 *
 * Corroboration tiers (marker EXISTENCE only — not parentage):
 *   CORROBORATED / LINE_ANCHORED_ONLY / PERMISSIVE_ONLY
 * from `segmentSubClauses` markers vs sectionizer `findMarkerCandidates`.
 * Same-style refusal stays mandatory regardless of tier agreement.
 *
 * Derived structure annotates only. It must never gate model input and must
 * never mint claim identity for flat families (see
 * docs/codex-program/notes/derived-structure-identity.md).
 *
 * Also exports:
 *   - `buildSectionOutline` — byte-mapped leaves + same-style flags + tiers
 *   - `resolveTerminationLimbChapeauViaStructure` — structural adapter for
 *     the termination limb finder (head-bounds at :/; ; semantic grammar
 *     stays in candidate-resolution.js). Live call site: DECISIONS.md §15
 *     swap — `findTerminationLimbChapeau` in candidate-resolution.js
 *     delegates its structural half here. Fail-closed / UNDETERMINED must
 *     surface as null to the caller, never a guessed chapeau.
 */

'use strict';

const {
  SEGMENTER_VERSION,
  segmentSubClauses,
  findStructuralMarkers,
} = require('../../parser-v2/subclauses');
const { findMarkerCandidates } = require('./deterministic-sectionizer');

const GOVERNING_STRUCTURE_SCHEMA = 'GOVERNING_STRUCTURE/V1';

const UNDETERMINED_REASONS = Object.freeze({
  SPAN_OUTSIDE_TEXT: 'SPAN_OUTSIDE_TEXT',
  SPAN_CROSSES_LEAVES: 'SPAN_CROSSES_LEAVES',
  SAME_STYLE_CHAIN: 'SAME_STYLE_CHAIN',
  AMBIGUOUS_OUTLINE: 'AMBIGUOUS_OUTLINE',
  MARKERLESS_SECTION_ONLY: 'MARKERLESS_SECTION_ONLY',
  NO_EVIDENCE_SPAN: 'NO_EVIDENCE_SPAN',
  EVIDENCE_CONFLICT: 'EVIDENCE_CONFLICT',
});

const MARKER_TIERS = Object.freeze({
  CORROBORATED: 'CORROBORATED',
  LINE_ANCHORED_ONLY: 'LINE_ANCHORED_ONLY',
  PERMISSIVE_ONLY: 'PERMISSIVE_ONLY',
});

function charToByteTable(text) {
  const table = new Array(text.length + 1);
  let byteOffset = 0;
  table[0] = 0;
  for (let i = 0; i < text.length; i++) {
    byteOffset += Buffer.byteLength(text[i], 'utf8');
    table[i + 1] = byteOffset;
  }
  return table;
}

function pathHasSameStyleLink(path, styleByPath) {
  if (typeof path !== 'string' || !path.includes('.')) return false;
  const segments = path.split('.');
  let prefix = segments[0];
  for (let i = 1; i < segments.length; i++) {
    const childPath = `${prefix}.${segments[i]}`;
    const parentStyle = styleByPath.get(prefix);
    const childStyle = styleByPath.get(childPath);
    if (parentStyle && childStyle && parentStyle === childStyle) return true;
    prefix = childPath;
  }
  return false;
}

function buildStyleByPath(markers) {
  const styleByPath = new Map();
  for (const marker of markers) {
    if (marker.path) styleByPath.set(marker.path, marker.style);
  }
  return styleByPath;
}

function sameStylePathsIn(markers) {
  const styleByPath = buildStyleByPath(markers);
  const flagged = [];
  for (const marker of markers) {
    if (pathHasSameStyleLink(marker.path, styleByPath)) flagged.push(marker.path);
  }
  return Object.freeze([...new Set(flagged)]);
}

function byteStartOfMarkerToken(charToByte, tokenStart) {
  return charToByte[tokenStart];
}

/**
 * Build per-marker corroboration tiers by aligning permissive
 * (findStructuralMarkers) starts with line-anchored (findMarkerCandidates)
 * starts. Offsets compared as UTF-8 byte offsets into sectionText.
 */
function corroborateMarkers({ sectionText, permissiveMarkers, charToByte }) {
  const lineAnchored = findMarkerCandidates(sectionText);
  const lineByByteStart = new Map();
  for (const candidate of lineAnchored) {
    const byteStart = byteStartOfMarkerToken(charToByte, candidate.start);
    if (!lineByByteStart.has(byteStart)) lineByByteStart.set(byteStart, candidate);
  }

  const permissiveByByteStart = new Map();
  for (const marker of permissiveMarkers) {
    const byteStart = byteStartOfMarkerToken(charToByte, marker.tokenStart);
    permissiveByByteStart.set(byteStart, marker);
  }

  const allStarts = new Set([...lineByByteStart.keys(), ...permissiveByByteStart.keys()]);
  const tiers = [];
  for (const startByte of [...allStarts].sort((a, b) => a - b)) {
    const line = lineByByteStart.get(startByte);
    const permissive = permissiveByByteStart.get(startByte);
    let tier;
    if (line && permissive) tier = MARKER_TIERS.CORROBORATED;
    else if (line) tier = MARKER_TIERS.LINE_ANCHORED_ONLY;
    else tier = MARKER_TIERS.PERMISSIVE_ONLY;
    tiers.push(Object.freeze({
      start_byte: startByte,
      label: (permissive && permissive.label) || (line && line.label) || null,
      path: (permissive && permissive.path) || null,
      tier,
    }));
  }
  return Object.freeze(tiers);
}

/**
 * Build the byte-mapped outline for a section once. Shared by resolve and
 * the placement pass.
 */
function buildSectionOutline(sectionText) {
  const text = String(sectionText || '');
  const charToByte = charToByteTable(text);
  const totalBytes = charToByte[text.length];
  const markers = findStructuralMarkers(text);
  const leavesUtf16 = segmentSubClauses(text);
  const styleByPath = buildStyleByPath(markers);
  const sameStylePaths = sameStylePathsIn(markers);
  const sameStylePathSet = new Set(sameStylePaths);

  const leaves = leavesUtf16.map((leaf) => {
    const startByte = charToByte[leaf.start];
    const endByte = charToByte[leaf.end];
    const chainTainted = leaf.marker != null
      && (sameStylePathSet.has(leaf.marker)
        || pathHasSameStyleLink(leaf.marker, styleByPath));
    return Object.freeze({
      path: leaf.marker,
      depth: leaf.depth,
      start_byte: startByte,
      end_byte: endByte,
      text: leaf.text,
      same_style_tainted: chainTainted,
    });
  });

  const markerless = markers.length === 0;
  const markerTiers = corroborateMarkers({
    sectionText: text,
    permissiveMarkers: markers,
    charToByte,
  });

  return Object.freeze({
    schema_version: GOVERNING_STRUCTURE_SCHEMA,
    segmenter_version: SEGMENTER_VERSION,
    total_bytes: totalBytes,
    markerless,
    same_style_paths: sameStylePaths,
    leaves: Object.freeze(leaves),
    marker_tiers: markerTiers,
    style_by_path: styleByPath,
  });
}

function ancestorPaths(path) {
  if (path == null) return [];
  const segments = String(path).split('.');
  const out = [];
  for (let i = 1; i < segments.length; i++) {
    out.push(segments.slice(0, i).join('.'));
  }
  return out;
}

/**
 * Chapeau chain for a resolved leaf: innermost-first, ending at the section
 * chapeau (path null). Each entry carries UTF-8 byte offsets and text.
 */
function buildChapeauChain(outline, leaf) {
  const byPath = new Map();
  for (const entry of outline.leaves) {
    if (!byPath.has(entry.path)) byPath.set(entry.path, entry);
  }
  const chain = [];
  chain.push({
    path: leaf.path,
    start_byte: leaf.start_byte,
    end_byte: leaf.end_byte,
    text: leaf.text,
  });
  for (const ancestor of ancestorPaths(leaf.path).reverse()) {
    const node = byPath.get(ancestor);
    if (node) {
      chain.push({
        path: node.path,
        start_byte: node.start_byte,
        end_byte: node.end_byte,
        text: node.text,
      });
    }
  }
  const sectionChapeau = byPath.get(null);
  if (sectionChapeau && leaf.path !== null) {
    chain.push({
      path: null,
      start_byte: sectionChapeau.start_byte,
      end_byte: sectionChapeau.end_byte,
      text: sectionChapeau.text,
    });
  }
  return Object.freeze(chain.map((entry) => Object.freeze(entry)));
}

function undetermined(reason, extra = null) {
  const body = {
    status: 'UNDETERMINED',
    reason,
    segmenter_version: SEGMENTER_VERSION,
    schema_version: GOVERNING_STRUCTURE_SCHEMA,
  };
  if (extra && typeof extra === 'object') Object.assign(body, extra);
  return Object.freeze(body);
}

function resolvedResult({ leaf, chain, outline, marker_tier = null }) {
  return Object.freeze({
    status: 'RESOLVED',
    schema_version: GOVERNING_STRUCTURE_SCHEMA,
    segmenter_version: SEGMENTER_VERSION,
    leaf: Object.freeze({
      path: leaf.path,
      depth: leaf.depth,
      start_byte: leaf.start_byte,
      end_byte: leaf.end_byte,
    }),
    chain,
    markerless: outline.markerless,
    marker_tier,
    same_style_paths: outline.same_style_paths,
  });
}

/**
 * resolveGoverningStructure({ sectionText, startByte, endByte, outline? })
 *
 * startByte/endByte are UTF-8 byte offsets into sectionText (half-open).
 */
function resolveGoverningStructure({
  sectionText,
  startByte,
  endByte,
  outline: outlineInput = null,
} = {}) {
  const text = String(sectionText || '');
  const outline = outlineInput || buildSectionOutline(text);
  const totalBytes = outline.total_bytes;

  if (!Number.isInteger(startByte) || !Number.isInteger(endByte)
    || startByte < 0 || endByte < startByte || endByte > totalBytes) {
    return undetermined(UNDETERMINED_REASONS.SPAN_OUTSIDE_TEXT, {
      start_byte: startByte,
      end_byte: endByte,
      total_bytes: totalBytes,
    });
  }
  if (startByte === endByte) {
    return undetermined(UNDETERMINED_REASONS.SPAN_OUTSIDE_TEXT, {
      start_byte: startByte,
      end_byte: endByte,
      detail: 'empty_span',
    });
  }

  const containing = [];
  for (const leaf of outline.leaves) {
    if (startByte >= leaf.start_byte && endByte <= leaf.end_byte) {
      containing.push(leaf);
    }
  }

  if (containing.length === 0) {
    return undetermined(UNDETERMINED_REASONS.SPAN_CROSSES_LEAVES, {
      start_byte: startByte,
      end_byte: endByte,
    });
  }

  containing.sort((a, b) => (b.depth - a.depth)
    || ((a.end_byte - a.start_byte) - (b.end_byte - b.start_byte)));
  const leaf = containing[0];

  if (leaf.same_style_tainted
    || (leaf.path != null && pathHasSameStyleLink(leaf.path, outline.style_by_path))) {
    return undetermined(UNDETERMINED_REASONS.SAME_STYLE_CHAIN, {
      path: leaf.path,
      same_style_paths: outline.same_style_paths,
    });
  }

  for (const ancestor of ancestorPaths(leaf.path)) {
    if (pathHasSameStyleLink(ancestor, outline.style_by_path)
      || outline.same_style_paths.includes(ancestor)) {
      return undetermined(UNDETERMINED_REASONS.SAME_STYLE_CHAIN, {
        path: leaf.path,
        tainted_ancestor: ancestor,
        same_style_paths: outline.same_style_paths,
      });
    }
  }

  const chain = buildChapeauChain(outline, leaf);

  let markerTier = null;
  if (leaf.path != null) {
    const leafMarker = outline.marker_tiers.find((tier) => tier.path === leaf.path);
    markerTier = leafMarker ? leafMarker.tier : MARKER_TIERS.PERMISSIVE_ONLY;
  }

  return resolvedResult({ leaf, chain, outline, marker_tier: markerTier });
}

/**
 * Structural adapter for findTerminationLimbChapeau (live since DECISIONS.md
 * §15 structural-half swap).
 *
 * Locates the unique paragraph-initial `(letter)` limb (fail closed on 0 or
 * >1), resolves governing structure for a one-byte probe at the marker, then
 * trims to the chapeau head at the first of `:` / `;` / newline. When
 * `resolveGoverningStructure` is UNDETERMINED, returns null — never invents
 * a chapeau. Semantic direction parsing and capacity comparison stay in
 * candidate-resolution.js (`parseTerminationLimbDirection` /
 * `findTerminationLimbGrantContext`).
 *
 * Returns `{ chapeau_text, start_byte, end_byte, governing }` relative to
 * sectionText (UTF-8 byte offsets), or null.
 */
function resolveTerminationLimbChapeauViaStructure({
  sectionText,
  letter,
  outline: outlineInput = null,
} = {}) {
  if (typeof letter !== 'string' || letter.length !== 1) return null;
  const text = String(sectionText || '');
  const markerPattern = new RegExp(`(?:^|\\n)\\(${letter}\\)\\s`, 'g');
  const matches = [];
  let match = markerPattern.exec(text);
  while (match !== null) {
    matches.push(match);
    match = markerPattern.exec(text);
  }
  if (matches.length !== 1) return null;

  const markerStart = matches[0].index + (matches[0][0].startsWith('\n') ? 1 : 0);
  // segmentSubClauses leaves begin at tokenEnd (after the marker token), not
  // at the open paren — probe just past "(x) " so containment hits the limb
  // leaf / parent chapeau-before-child.
  const markerTokenEnd = markerStart + letter.length + 2; // "(x)"
  let probeChar = markerTokenEnd;
  while (probeChar < text.length && /\s/.test(text[probeChar])) probeChar += 1;
  if (probeChar >= text.length) probeChar = Math.min(markerTokenEnd, text.length - 1);

  const outline = outlineInput || buildSectionOutline(text);
  const charToByte = charToByteTable(text);
  const probeStart = charToByte[probeChar];
  const probeEnd = Math.min(probeStart + Math.max(1, charToByte[probeChar + 1] - probeStart), outline.total_bytes);
  if (probeEnd <= probeStart) return null;
  const resolved = resolveGoverningStructure({
    sectionText: text,
    startByte: probeStart,
    endByte: probeEnd,
    outline,
  });
  if (resolved.status !== 'RESOLVED') return null;

  const colonIndex = text.indexOf(':', markerStart);
  const semicolonIndex = text.indexOf(';', markerStart);
  const newlineIndex = text.indexOf('\n', markerStart);
  const boundCandidates = [colonIndex, semicolonIndex].filter((index) => index >= 0);
  if (boundCandidates.length === 0 && newlineIndex >= 0) boundCandidates.push(newlineIndex);
  if (boundCandidates.length === 0 && text.length > markerStart) {
    boundCandidates.push(text.length - 1);
  }
  if (boundCandidates.length === 0) return null;
  const boundIndex = Math.min(...boundCandidates);
  const chapeauText = text.slice(markerStart, boundIndex + 1);
  return Object.freeze({
    chapeau_text: chapeauText,
    start_byte: charToByte[markerStart],
    end_byte: charToByte[boundIndex + 1],
    governing: resolved,
    segmenter_version: SEGMENTER_VERSION,
  });
}

module.exports = {
  GOVERNING_STRUCTURE_SCHEMA,
  SEGMENTER_VERSION,
  UNDETERMINED_REASONS,
  MARKER_TIERS,
  buildSectionOutline,
  resolveGoverningStructure,
  resolveTerminationLimbChapeauViaStructure,
  pathHasSameStyleLink,
  sameStylePathsIn,
  charToByteTable,
};
