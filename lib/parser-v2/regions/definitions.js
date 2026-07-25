const DEFINITION_VERB_SOURCE = String.raw`(?:means|shall\s+mean|has\s+the\s+meaning|will\s+have\s+the\s+meaning|refers\s+to)`;
const QUOTED_TERM_SOURCE = String.raw`["“][^"”\n]{2,120}["”]`;
const UNQUOTED_INLINE_TERM_SOURCE = String.raw`[A-Z][A-Za-z0-9'’&.-]*(?:[ \t]+(?:of|the|and|or|for|to|[A-Z][A-Za-z0-9'’&.-]*)){0,11}`;
const PURPOSE_PREFIX_SOURCE = String.raw`\bFor purposes of (?:this|the) Agreement,\s+(?:the term\s+)?`;

function definitionSignalPattern() {
  return new RegExp(
    `(?:${QUOTED_TERM_SOURCE}`
      + `|${PURPOSE_PREFIX_SOURCE}${UNQUOTED_INLINE_TERM_SOURCE})`
      + `\\s+${DEFINITION_VERB_SOURCE}\\b`,
    'g',
  );
}

function looksLikeDefinitionsSection(section) {
  const title = String(section && (section.title || section.heading || '') || '');
  const articleTitle = String(section && section.articleTitle || '');
  return (
    /definitions?|terms?\s+defined\s+elsewhere|defined\s+terms?\s+index/i.test(title) ||
    /definitions?/i.test(articleTitle)
  );
}

function findDefinitionUnits(text, maximum = Number.POSITIVE_INFINITY) {
  const body = String(text || '');
  const termRe = /(^|\n+|[.;]\s+)(["“][^"”\n]{2,120}["”]|[A-Z][A-Za-z0-9'’&., -]{2,80})\s+(?:means|shall\s+mean|has\s+the\s+meaning|will\s+have\s+the\s+meaning|refers\s+to)\b/g;
  const hits = [];
  let m;
  while ((m = termRe.exec(body)) !== null) {
    if (hits.length >= maximum) {
      throw new RangeError('definition units exceed their governed limit');
    }
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

function markerKind(marker) {
  if (/^\d+$/.test(marker)) return 'NUMBER';
  if (/^[A-Z]$/.test(marker)) return 'UPPER_ALPHA';
  if (/^(?:i|ii|iii|iv|v|vi|vii|viii|ix|x)$/i.test(marker)) {
    return 'ROMAN';
  }
  if (/^[a-z]$/.test(marker)) return 'LOWER_ALPHA';
  return null;
}

function lineMarkerKinds(body) {
  const markerRe = /(?:^|\n)[ \t]*\(([A-Za-z0-9]+)\)/g;
  const markers = [];
  let match;
  while ((match = markerRe.exec(body)) !== null) {
    const kind = markerKind(match[1]);
    if (kind) {
      markers.push({
        index: match.index + match[0].indexOf('('),
        kind,
      });
    }
  }
  return markers;
}

function followingSiblingMarkerKind(body, punctuationIndex, ceiling) {
  let cursor = punctuationIndex + 1;
  let sawNewline = false;
  while (cursor < ceiling && /\s/.test(body[cursor])) {
    if (body[cursor] === '\n' || body[cursor] === '\r') sawNewline = true;
    cursor += 1;
  }
  const connector = body.slice(cursor, Math.min(ceiling, cursor + 4))
    .match(/^(?:and|or)\b/i);
  if (connector) {
    cursor += connector[0].length;
    while (cursor < ceiling && /\s/.test(body[cursor])) {
      if (body[cursor] === '\n' || body[cursor] === '\r') sawNewline = true;
      cursor += 1;
    }
  }
  if (!sawNewline) return null;
  const marker = body.slice(cursor, Math.min(ceiling, cursor + 24))
    .match(/^\(([A-Za-z0-9]+)\)/);
  return marker ? markerKind(marker[1]) : null;
}

function markerIndexAtOrAfter(markers, position) {
  let low = 0;
  let high = markers.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (markers[middle].index < position) low = middle + 1;
    else high = middle;
  }
  return low;
}

function inlineDefinitionEnd(
  body,
  bodyStart,
  ceiling,
  parentMarkerKind,
  markers,
) {
  let roundDepth = 0;
  let squareDepth = 0;
  let curlyDepth = 0;
  let straightQuoteOpen = false;
  let curlyQuoteOpen = false;
  let sameKindMarkerSeenInBody = false;
  let bodyMarkerIndex = markerIndexAtOrAfter(markers, bodyStart);
  for (let index = bodyStart; index < ceiling; index += 1) {
    while (bodyMarkerIndex < markers.length
      && markers[bodyMarkerIndex].index <= index) {
      if (markers[bodyMarkerIndex].kind === parentMarkerKind) {
        sameKindMarkerSeenInBody = true;
      }
      bodyMarkerIndex += 1;
    }
    const character = body[index];
    if (character === '\\' && straightQuoteOpen) {
      index += 1;
      continue;
    }
    if (character === '"' && !curlyQuoteOpen) {
      straightQuoteOpen = !straightQuoteOpen;
      continue;
    }
    if (character === '“' && !straightQuoteOpen) {
      curlyQuoteOpen = true;
      continue;
    }
    if (character === '”' && curlyQuoteOpen) {
      curlyQuoteOpen = false;
      continue;
    }
    if (straightQuoteOpen || curlyQuoteOpen) continue;
    if (character === '(') roundDepth += 1;
    else if (character === ')' && roundDepth > 0) roundDepth -= 1;
    else if (character === '[') squareDepth += 1;
    else if (character === ']' && squareDepth > 0) squareDepth -= 1;
    else if (character === '{') curlyDepth += 1;
    else if (character === '}' && curlyDepth > 0) curlyDepth -= 1;
    if (roundDepth !== 0 || squareDepth !== 0 || curlyDepth !== 0) continue;
    if (character === ';') {
      let next = index + 1;
      while (next < ceiling && /\s/.test(body[next])) next += 1;
      if (next >= ceiling) return index + 1;
      const siblingKind = followingSiblingMarkerKind(body, index, ceiling);
      if (parentMarkerKind
        && siblingKind === parentMarkerKind
        && !sameKindMarkerSeenInBody) {
        return index + 1;
      }
      continue;
    }
    if (character !== '.') continue;
    let next = index + 1;
    while (next < ceiling && /\s/.test(body[next])) next += 1;
    if (next >= ceiling) return index + 1;
  }
  return ceiling;
}

function findInlineDefinitionUnits(text, maximum = Number.POSITIVE_INFINITY) {
  const body = String(text || '');
  const quotedTermRe = new RegExp(
    `["“]([^"”\\n]{2,120})["”]\\s+${DEFINITION_VERB_SOURCE}\\b`,
    'g',
  );
  const unquotedPurposeTermRe = new RegExp(
    `${PURPOSE_PREFIX_SOURCE}(${UNQUOTED_INLINE_TERM_SOURCE})`
      + `\\s+${DEFINITION_VERB_SOURCE}\\b`,
    'g',
  );
  const hits = [];
  let match;
  while ((match = quotedTermRe.exec(body)) !== null) {
    if (hits.length >= maximum) {
      throw new RangeError('inline definition units exceed their governed limit');
    }
    const term = match[1].trim();
    if (!term) continue;
    hits.push({
      term,
      start: match.index,
      bodyStart: quotedTermRe.lastIndex,
    });
  }
  while ((match = unquotedPurposeTermRe.exec(body)) !== null) {
    if (hits.length >= maximum) {
      throw new RangeError('inline definition units exceed their governed limit');
    }
    const term = match[1].trim();
    if (!term) continue;
    const termOffset = match[0].lastIndexOf(match[1]);
    hits.push({
      term,
      start: match.index + termOffset,
      bodyStart: unquotedPurposeTermRe.lastIndex,
    });
  }
  hits.sort((left, right) => left.start - right.start || left.bodyStart - right.bodyStart);
  const markers = lineMarkerKinds(body);
  let markerIndex = 0;
  let parentMarkerKind = null;
  return hits.map((hit, index) => {
    while (markerIndex < markers.length && markers[markerIndex].index < hit.start) {
      parentMarkerKind = markers[markerIndex].kind;
      markerIndex += 1;
    }
    const ceiling = index + 1 < hits.length ? hits[index + 1].start : body.length;
    const end = inlineDefinitionEnd(
      body,
      hit.bodyStart,
      ceiling,
      parentMarkerKind,
      markers,
    );
    return {
      term: hit.term,
      start: hit.start,
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
  definitionSignalPattern,
  looksLikeDefinitionsSection,
  findDefinitionUnits,
  findInlineDefinitionUnits,
  looksLikeDefinedTermsIndex,
  analyzeDefinitionCompleteness,
};
