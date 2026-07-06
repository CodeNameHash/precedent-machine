function refPattern() {
  return '(?:Section\\s+|§\\s*)?\\d{1,2}\\.\\d{1,3}(?:\\([a-z0-9]+\\))*|Article\\s+(?:[IVXLCDM]+|\\d+)';
}

function lineLooksLikeHeader(line) {
  return /^(?:INDEX\s+OF\s+DEFINED\s+TERMS|DEFINED\s+TERMS|Defined\s+Term|Location\s+of\s+Definition|Definition)$/i
    .test(String(line || '').trim());
}

function lineLooksLikeTerm(line) {
  const t = String(line || '').trim();
  if (t.length < 2 || t.length > 120) return false;
  if (!/^[A-Za-z"“]/.test(t)) return false;
  if (/^(?:Section|Article|Exhibit|Annex|Schedule|Page)\b/i.test(t)) return false;
  if (new RegExp(`^(?:${refPattern()})$`, 'i').test(t)) return false;
  return /[A-Za-z]/.test(t);
}

function lineLooksLikeRef(line) {
  return new RegExp(`^(?:${refPattern()})$`, 'i').test(String(line || '').trim());
}

function lineLooksLikeSameLinePair(line) {
  const t = String(line || '').trim();
  if (t.length < 8 || t.length > 180) return false;
  const re = new RegExp(`^(.{2,110}?)(?:\\s+\\.{2,}\\s*|\\s{2,}|\\s+)(?:${refPattern()})$`, 'i');
  const m = t.match(re);
  if (!m) return false;
  return lineLooksLikeTerm(m[1]);
}

function lineStartsSubstantiveBody(line) {
  const t = String(line || '').trim();
  return /^ARTICLE\s+(?:[IVXLCDM]+|\d+)\b/.test(t)
    || /^(?:SECTION|Section)\s+\d{1,2}\.\d{1,3}\b/.test(t)
    || /^IN\s+WITNESS\s+WHEREOF\b/i.test(t)
    || /^WHEREAS\b/i.test(t)
    || /^NOW\s*,?\s+THEREFORE\b/i.test(t);
}

function lineOffsets(text) {
  const lines = String(text || '').split('\n');
  const out = [];
  let pos = 0;
  for (const line of lines) {
    out.push({ line, start: pos, end: pos + line.length });
    pos += line.length + 1;
  }
  return out;
}

function detectDefinedTermsTocRanges(text) {
  const lines = lineOffsets(text);
  const ranges = [];

  for (let i = 0; i < lines.length; i++) {
    let j = i;
    let pairs = 0;
    let sawHeader = false;
    let lastContent = -1;

    while (j < lines.length) {
      const t = lines[j].line.trim();
      if (!t) {
        j += 1;
        continue;
      }
      if (lineLooksLikeHeader(t)) {
        sawHeader = true;
        lastContent = j;
        j += 1;
        continue;
      }
      if (lineStartsSubstantiveBody(t) && pairs < 5) break;
      if (lineLooksLikeSameLinePair(t)) {
        pairs += 1;
        lastContent = j;
        j += 1;
        continue;
      }
      if (lineLooksLikeTerm(t)) {
        let k = j + 1;
        while (k < lines.length && !lines[k].line.trim()) k += 1;
        if (k < lines.length && lineLooksLikeRef(lines[k].line)) {
          pairs += 1;
          lastContent = k;
          j = k + 1;
          continue;
        }
      }
      break;
    }

    if (pairs >= 5) {
      const startLine = sawHeader
        ? Math.max(0, i)
        : i;
      const start = lines[startLine].start;
      const end = lines[lastContent].end;
      ranges.push({ start, end, pairs });
      i = lastContent;
    }
  }

  return ranges;
}

function stripDefinedTermsToc(text) {
  const source = String(text || '');
  const ranges = detectDefinedTermsTocRanges(source);
  if (!ranges.length) return source;

  let out = '';
  let cursor = 0;
  for (const range of ranges) {
    out += source.slice(cursor, range.start);
    cursor = range.end;
  }
  out += source.slice(cursor);
  return out.replace(/\n{3,}/g, '\n\n');
}

module.exports = {
  detectDefinedTermsTocRanges,
  stripDefinedTermsToc,
  lineLooksLikeSameLinePair,
};
