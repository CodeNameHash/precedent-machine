const ENACTING_RE = /\b(?:NOW\s*,?\s+THEREFORE|NOW\s+THEREFORE|IT\s+IS\s+HEREBY\s+AGREED|THE\s+PARTIES\s+HEREBY\s+AGREE|THE\s+PARTIES\s+AGREE\s+AS\s+FOLLOWS|AGREE\s+AS\s+FOLLOWS)\b/i;

function findEnactingClause(text) {
  const source = String(text || '');
  const m = ENACTING_RE.exec(source);
  if (!m) return null;
  const lineEnd = source.indexOf('\n', m.index);
  if (lineEnd !== -1) {
    const afterLine = source.slice(lineEnd + 1, lineEnd + 240);
    if (/^\s*(?:Article\s+(?:I|1)\b|(?:SECTION|Section)\s+1\.0?1\b|1\.0?1\.?\s+[A-Z])/i.test(afterLine)) {
      return {
        start: m.index,
        end: lineEnd,
        text: m[0],
      };
    }
  }
  const paraEnd = source.indexOf('\n\n', m.index);
  return {
    start: m.index,
    end: paraEnd === -1 ? Math.min(source.length, m.index + m[0].length) : paraEnd,
    text: m[0],
  };
}

function findFirstBodyHeadingAfter(text, offset) {
  const source = String(text || '');
  const tail = source.slice(Math.max(0, Number(offset) || 0));
  const patterns = [
    /\n[ \t]*(Article\s+(?:I|1))\b/i,
    /\n[ \t]*(?:SECTION|Section)\s+1\.0?1\b/,
    /\n\s*\n[ \t]*(ARTICLE\s+(?:[IVXLCDM]+|\d+))\b/i,
    /\n\s*\n[ \t]*(?:SECTION|Section)\s+1\.\d{1,3}\b/,
    /\n\s*\n[ \t]*1\.0?1\.?[ \t]+(?=[A-Z][^\n]{2,120}\.)/,
  ];

  let best = null;
  for (const pattern of patterns) {
    const m = pattern.exec(tail);
    if (!m) continue;
    const start = offset + m.index + (m[0].startsWith('\n') ? m[0].search(/[A-Za-z0-9]/) : 0);
    if (best == null || start < best) best = start;
  }
  return best;
}

function bodyStartAfterEnactingHardWall(text, proposedBodyStart) {
  const source = String(text || '');
  const proposed = Math.max(0, Number(proposedBodyStart) || 0);
  const clause = findEnactingClause(source);
  if (!clause || proposed >= clause.end) return proposed;
  const after = findFirstBodyHeadingAfter(source, clause.end);
  return after == null ? proposed : after;
}

module.exports = {
  ENACTING_RE,
  findEnactingClause,
  findFirstBodyHeadingAfter,
  bodyStartAfterEnactingHardWall,
};
