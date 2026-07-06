function startsHardBoundary(text) {
  return /^\s*(?:ARTICLE\s+(?:[IVXLCDM]+|\d+)\b|IN\s+WITNESS\s+WHEREOF\b|(?:EXHIBIT|ANNEX|SCHEDULE)\s+[A-Z0-9IVXLCDM.-]+\b)/i
    .test(String(text || ''));
}

function startsSectionHeader(text) {
  return /^\s*(?:(?:SECTION|Section)\s+)?\d{1,2}\.\d{1,3}\b\.?\s+[A-Z]/.test(String(text || ''))
    || /^\s*(?:SECTION|Section)\s+\d{1,2}\.\d{1,3}\b/i.test(String(text || ''));
}

function startsDefinedTermHeader(text) {
  return /^\s*(?:"[^"]{2,120}"|“[^”]{2,120}”|[A-Z][A-Za-z0-9'’&., -]{2,100})\s+(?:means|shall\s+mean|has\s+the\s+meaning|will\s+have\s+the\s+meaning)\b/
    .test(String(text || ''));
}

function isInvalidTerminator(prevText, nextText) {
  const prev = String(prevText || '').trim();
  const next = String(nextText || '');
  if (!prev) return false;
  if (startsHardBoundary(next) || startsSectionHeader(next) || startsDefinedTermHeader(next) || !next.trim()) return false;
  if (/\b(?:see|subject\s+to|pursuant\s+to|in\s+accordance\s+with)\s+Section\s+\d/i.test(prev.slice(-160))) return true;
  if (/^\s*\([a-z]\)\s+/i.test(next)) return true;
  if (prev.length < 40) return true;
  return false;
}

function analyzeProvisionCompleteness(region, fullText) {
  if (!region || !/^body\.section\.(?:provision|definition)$/.test(region.type || '')) return null;
  const source = String(fullText || '');
  const start = Math.max(0, Number(region.start) || 0);
  const end = Math.max(start, Number(region.end) || start);
  const prev = source.slice(start, end);
  const next = source.slice(end, Math.min(source.length, end + 500));
  if (!isInvalidTerminator(prev, next)) return null;
  return {
    code: 'provision-invalid-terminator',
    start,
    end,
    needsExtension: true,
  };
}

module.exports = {
  startsHardBoundary,
  startsSectionHeader,
  startsDefinedTermHeader,
  isInvalidTerminator,
  analyzeProvisionCompleteness,
};
