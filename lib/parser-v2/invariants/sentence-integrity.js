const LEAF_REGION_TYPES = new Set([
  'body.section.provision',
  'body.section.definition',
  'body.section.unassigned',
  'body.section.partial',
  'preamble.recitals',
]);

function trimmedTail(text) {
  return String(text || '').replace(/\s+$/g, '');
}

function lastMeaningfulChar(text) {
  const t = trimmedTail(text);
  if (!t) return '';
  let i = t.length - 1;
  while (i > 0 && /["')\]]/.test(t[i])) i -= 1;
  return t[i] || '';
}

function nextStartsList(text) {
  return /^\s*(?:\([a-z0-9ivxlcdm]+\)|(?:Section\s+)?\d{1,2}\.\d{1,3}|ARTICLE\s+(?:[IVXLCDM]+|\d+))\b/i
    .test(String(text || ''));
}

function nextStartsInnerList(text) {
  return /^\s*(?:\([a-z0-9ivxlcdm]+\)|\d+\.)\s+/i.test(String(text || ''));
}

function nextStartsNewSentence(text) {
  const t = String(text || '').replace(/^\s+/, '');
  if (!t) return true;
  return /^[A-Z"“]/.test(t) || nextStartsList(t);
}

function isLegalSentenceBoundary(prevText, nextText = '') {
  const ch = lastMeaningfulChar(prevText);
  if (!ch) return true;
  if (/[.?!]/.test(ch)) return nextStartsNewSentence(nextText);
  if (ch === ';') return nextStartsList(nextText);
  if (ch === ':') return nextStartsInnerList(nextText);
  return false;
}

function extendToSentenceBoundary(text, endOffset, hardEnd) {
  const source = String(text || '');
  const limit = Math.max(0, Math.min(source.length, hardEnd == null ? source.length : Number(hardEnd)));
  let end = Math.max(0, Math.min(limit, Number(endOffset) || 0));

  while (end < limit) {
    const nextStop = source.slice(end).search(/[.?!;:]["')\]]?(?=\s|$)/);
    if (nextStop < 0) return limit;
    end += nextStop + 1;
    const prev = source.slice(0, end);
    const next = source.slice(end, Math.min(limit, end + 240));
    if (isLegalSentenceBoundary(prev, next)) return end;
  }

  return limit;
}

function assertSentenceIntegrity(region, fullText) {
  if (!region || !LEAF_REGION_TYPES.has(region.type)) return null;
  const source = String(fullText || '');
  const start = Math.max(0, Number(region.start) || 0);
  const end = Math.max(start, Number(region.end) || start);
  const prev = source.slice(start, end);
  const next = source.slice(end, Math.min(source.length, end + 240));
  if (isLegalSentenceBoundary(prev, next)) return null;
  return {
    code: 'sentence-boundary-inside-sentence',
    start,
    end,
    needsExtension: true,
  };
}

module.exports = {
  LEAF_REGION_TYPES,
  isLegalSentenceBoundary,
  extendToSentenceBoundary,
  assertSentenceIntegrity,
  nextStartsList,
};
