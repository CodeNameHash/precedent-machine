function isZeroWidth(ch) {
  return /[\uFEFF\u200B\u200C\u200D\u2060\u200E\u200F]/.test(ch);
}

function normalizeChar(ch) {
  if (ch === '\u00a0' || ch === '\u202f') return ' ';
  if (/[\u201c\u201d]/.test(ch)) return '"';
  if (/[\u2018\u2019]/.test(ch)) return "'";
  return ch;
}

function isStandalonePageLine(line) {
  const t = String(line || '').trim();
  return /^Page\s+\d+\s+of\s+\d+$/i.test(t)
    || /^\d{1,4}$/.test(t)
    || /^-\s*\d{1,4}\s*-$/.test(t);
}

function isStrayPipe(raw, index) {
  if (raw[index] !== '|') return false;
  const prev = raw[index - 1] || '';
  let nextIndex = index + 1;
  while (isZeroWidth(raw[nextIndex] || '')) nextIndex += 1;
  const next = raw[nextIndex] || '';
  if (/[A-Za-z0-9]/.test(prev) && /[A-Za-z0-9]/.test(next)) return true;
  if (/[A-Za-z0-9.,;:)\]]/.test(prev) && /[\s.,;:([A-Za-z0-9]/.test(next)) return true;
  return false;
}

function nextLineStartsLowercase(raw, indexAfterNewline) {
  let i = indexAfterNewline;
  while (i < raw.length && /[ \t\r]/.test(raw[i])) i++;
  return /^[a-z]/.test(raw[i] || '');
}

function append(out, map, value, rawIndex) {
  for (let i = 0; i < value.length; i++) {
    out.push(value[i]);
    map.push(rawIndex);
  }
}

function collapseExcessNewlines(out, map) {
  while (out.length >= 3) {
    const n = out.length;
    if (out[n - 1] !== '\n' || out[n - 2] !== '\n' || out[n - 3] !== '\n') break;
    out.splice(n - 1, 1);
    map.splice(n - 1, 1);
  }
}

function rawLineAt(raw, index) {
  const end = raw.indexOf('\n', index);
  return end === -1 ? raw.slice(index) : raw.slice(index, end);
}

function buildLayers(rawText) {
  const rawTextString = String(rawText || '');
  const out = [];
  const cleanToRaw = [];
  let i = 0;

  while (i < rawTextString.length) {
    const line = rawLineAt(rawTextString, i);
    const lineEnd = i + line.length;
    const hasNewline = rawTextString[lineEnd] === '\n';
    let skipLineNewline = false;

    if (isStandalonePageLine(line)) {
      i = lineEnd + (hasNewline ? 1 : 0);
      continue;
    }

    while (i < lineEnd) {
      const ch = rawTextString[i];
      const next = rawTextString[i + 1] || '';

      if (isZeroWidth(ch) || isStrayPipe(rawTextString, i)) {
        i += 1;
        continue;
      }

      if (ch === '(') {
        const markerMatch = rawTextString.slice(i, lineEnd).match(/^\(\s*([a-z0-9ivxlcdm]{1,6})\s*\)/i);
        if (markerMatch) {
          const token = markerMatch[1];
          const tokenStart = rawTextString.indexOf(token, i);
          const closeIndex = i + markerMatch[0].lastIndexOf(')');
          append(out, cleanToRaw, '(', i);
          for (let ti = 0; ti < token.length; ti++) {
            append(out, cleanToRaw, token[ti], tokenStart + ti);
          }
          append(out, cleanToRaw, ')', closeIndex);
          i += markerMatch[0].length;
          continue;
        }
      }

      if (ch === '-' && next === '\n' && nextLineStartsLowercase(rawTextString, i + 2)) {
        i += 2;
        skipLineNewline = true;
        continue;
      }

      if (
        ch === ' ' &&
        rawTextString[i + 1] === '.' &&
        /\d+\.\d+$/.test(rawTextString.slice(Math.max(0, i - 12), i))
      ) {
        i += 1;
        continue;
      }

      append(out, cleanToRaw, normalizeChar(ch), i);
      i += 1;
    }

    if (hasNewline && !skipLineNewline) {
      append(out, cleanToRaw, '\n', lineEnd);
      collapseExcessNewlines(out, cleanToRaw);
      i = lineEnd + 1;
    } else if (skipLineNewline) {
      i = Math.max(i, lineEnd + 1);
    }
  }

  const cleanText = out.join('');

  return {
    cleanText,
    rawText: rawTextString,
    mapCleanToRaw(cleanOffset) {
      const offset = Math.max(0, Math.min(cleanText.length, Number(cleanOffset) || 0));
      if (offset >= cleanToRaw.length) return rawTextString.length;
      return cleanToRaw[offset];
    },
  };
}

function normalizeBoundaryNoise(rawText) {
  return buildLayers(rawText).cleanText;
}

module.exports = {
  buildLayers,
  normalizeBoundaryNoise,
};
