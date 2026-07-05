function looksLikeDefinitionsSection(section) {
  const title = String(section && (section.title || section.heading || '') || '');
  const articleTitle = String(section && section.articleTitle || '');
  return (
    /definitions?|terms?\s+defined\s+elsewhere|defined\s+terms?\s+index/i.test(title) ||
    /definitions?/i.test(articleTitle)
  );
}

function findDefinitionUnits(text) {
  const body = String(text || '');
  const termRe = /(^|\n+|[.;]\s+)(["“][^"”\n]{2,120}["”]|[A-Z][A-Za-z0-9'’&., -]{2,80})\s+(?:means|shall\s+mean|has\s+the\s+meaning|will\s+have\s+the\s+meaning|refers\s+to)\b/g;
  const hits = [];
  let m;
  while ((m = termRe.exec(body)) !== null) {
    const start = m.index + m[1].length;
    hits.push({
      term: m[2].replace(/^["“]|["”]$/g, '').trim(),
      start,
    });
  }
  return hits.map((hit, index) => {
    const end = index + 1 < hits.length ? hits[index + 1].start : body.length;
    return {
      ...hit,
      end,
      length: end - hit.start,
    };
  });
}

function looksLikeDefinedTermsIndex(section, text) {
  const title = String(section && (section.title || section.heading || '') || '');
  const body = String(text || '').slice(0, 1200);
  return (
    /terms?\s+defined\s+elsewhere|defined\s+terms?\s+index/i.test(title) ||
    /following\s+capitalized\s+terms\s+are\s+defined\s+in\s+this\s+Agreement\s+as\s+referenced/i.test(body) ||
    /Definition\s+Section\s+[A-Z][A-Za-z]+\s+\d/i.test(body)
  );
}

function markerIsSectionReferenceSuffix(chunk, markerStart) {
  const before = chunk.substring(Math.max(0, markerStart - 80), markerStart);
  return /Section\s+\d[\dA-Za-z().,\s]*$/i.test(before);
}

function hasLetteredItem(chunk, letters) {
  const re = /(?:^|[\s;:,])\(([a-z])\)\s+([A-Za-z]+)/gi;
  let m;
  while ((m = re.exec(chunk)) !== null) {
    if (!letters.includes(m[1].toLowerCase())) continue;
    const markerStart = m.index + m[0].indexOf('(');
    if (markerIsSectionReferenceSuffix(chunk, markerStart)) continue;
    const nextWord = String(m[2] || '').toLowerCase();
    if (nextWord === 'and' || nextWord === 'or') continue;
    return true;
  }
  return false;
}

function analyzeDefinitionCompleteness(section) {
  if (!looksLikeDefinitionsSection(section)) return [];
  const text = String(section && section.text || '');
  const warnings = [];
  const units = findDefinitionUnits(text);

  if (units.length === 0 && text.length > 250 && !looksLikeDefinedTermsIndex(section, text)) {
    warnings.push({
      code: 'definition-units-not-detected',
      message: 'Definitions section detected, but no individual definition anchors were found.',
    });
  }

  for (const unit of units) {
    const chunk = text.substring(unit.start, unit.end);
    const hasOpeningLetteredItem = hasLetteredItem(chunk, ['a']);
    const hasLaterLetteredItem = hasLetteredItem(chunk, 'bcdefghijklmnopqrstuvwxyz');
    const startsWithLaterLetteredItem = /^\s*\([b-z]\)\s+[A-Za-z]/i.test(chunk);
    if ((startsWithLaterLetteredItem || hasLaterLetteredItem) && !hasOpeningLetteredItem) {
      warnings.push({
        code: 'definition-mid-slice',
        term: unit.term,
        message: 'Definition unit contains later lettered clauses without an opening (a) marker.',
      });
    }
    if (chunk.trim().length > 80 && !/[.;)]\s*$/.test(chunk.trim())) {
      warnings.push({
        code: 'definition-open-ended',
        term: unit.term,
        message: 'Definition unit does not end on normal definition punctuation.',
      });
    }
  }

  return warnings;
}

module.exports = {
  looksLikeDefinitionsSection,
  findDefinitionUnits,
  looksLikeDefinedTermsIndex,
  analyzeDefinitionCompleteness,
};
