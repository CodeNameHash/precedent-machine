function markerValue(marker) {
  const raw = String(marker || '').toLowerCase();
  if (/^[a-z]$/.test(raw)) return raw.charCodeAt(0) - 96;
  if (/^\d+$/.test(raw)) return Number(raw);
  const romans = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10 };
  return romans[raw] || null;
}

function findListMarkers(text) {
  const out = [];
  const re = /(^|\n)([ \t]*)\(([a-z]|\d+|i{1,3}|iv|v|vi{1,3}|ix|x)\)\s+/gi;
  let m;
  while ((m = re.exec(String(text || ''))) !== null) {
    out.push({
      marker: m[3].toLowerCase(),
      value: markerValue(m[3]),
      indent: m[2].length,
      index: m.index + m[1].length,
    });
  }
  return out;
}

function hasMonotonicListRun(markers) {
  for (let i = 0; i < markers.length - 1; i++) {
    const a = markers[i];
    const b = markers[i + 1];
    if (a.indent === b.indent && a.value != null && b.value === a.value + 1) return true;
  }
  return false;
}

function listWouldContinueAcrossBoundary(beforeText, afterText) {
  const before = findListMarkers(beforeText);
  if (!before.length) return false;
  const last = before[before.length - 1];
  if (last.value == null) return false;

  const next = findListMarkers(String(afterText || '').slice(0, 200));
  return next.some((marker) => marker.indent === last.indent && marker.value === last.value + 1);
}

function hasOpenListContinuity(text) {
  const markers = findListMarkers(text);
  return markers.length >= 2 && hasMonotonicListRun(markers);
}

module.exports = {
  findListMarkers,
  hasOpenListContinuity,
  listWouldContinueAcrossBoundary,
};
