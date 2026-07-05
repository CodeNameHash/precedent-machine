function looksLikeDefinitionsSection(section) {
  const title = String(section && (section.title || section.heading || '') || '');
  const articleTitle = String(section && section.articleTitle || '');
  return /definitions?/i.test(title) || /definitions?/i.test(articleTitle);
}

function findDefinitionUnits(text) {
  const body = String(text || '');
  const termRe = /(?:^|\n|\s)(["“][^"”\n]{2,100}["”]|[A-Z][A-Za-z0-9'’&., -]{2,80})\s+(?:means|shall\s+mean|has\s+the\s+meaning|will\s+have\s+the\s+meaning)\b/g;
  const hits = [];
  let m;
  while ((m = termRe.exec(body)) !== null) {
    const start = m.index + m[0].indexOf(m[1]);
    hits.push({
      term: m[1].replace(/^["“]|["”]$/g, '').trim(),
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

function analyzeDefinitionCompleteness(section) {
  if (!looksLikeDefinitionsSection(section)) return [];
  const text = String(section && section.text || '');
  const warnings = [];
  const units = findDefinitionUnits(text);

  if (units.length === 0 && text.length > 250) {
    warnings.push({
      code: 'definition-units-not-detected',
      message: 'Definitions section detected, but no individual definition anchors were found.',
    });
  }

  for (const unit of units) {
    const chunk = text.substring(unit.start, unit.end);
    if (/\([b-z]\)/i.test(chunk) && !/\(a\)/i.test(chunk)) {
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
  analyzeDefinitionCompleteness,
};
