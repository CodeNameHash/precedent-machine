'use strict';

const INLINE_STRUCTURE_SCHEMA_VERSION = 'AGREEMENT_INLINE_STRUCTURE/V1';
const INLINE_STRUCTURE_PARSER_VERSION = 'AGREEMENT_INLINE_STRUCTURE_PARSER/V1';
const OFFSET_COORDINATE_SYSTEM = 'UTF16_CODE_UNIT_HALF_OPEN';
const MAX_INLINE_DEPTH = 5;
const MARKER_PATTERN = /\(([A-Za-z]{1,5}|[0-9]{1,3})\)/g;
const ROMAN_LABELS = Object.freeze([
  'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x',
  'xi', 'xii', 'xiii', 'xiv', 'xv', 'xvi', 'xvii', 'xviii', 'xix', 'xx',
]);
const ROMAN_INDEX = new Map(ROMAN_LABELS.map((label, index) => [label, index]));
const STOP_WORDS = new Set([
  'above', 'and', 'below', 'clause', 'clauses', 'each', 'item', 'items', 'of',
  'or', 'paragraph', 'paragraphs', 'part', 'parts', 'section', 'sections',
  'subsection', 'subsections', 'the', 'through', 'to',
]);
const REFERENCE_LEAD = /\b(?:articles?|clauses?|items?|paragraphs?|parts?|sections?|subsections?)\s*$/i;
const REFERENCE_PAIR_LEAD = /\b(?:(?:in\s+the\s+case\s+of\s+)?(?:any|both|each|either)\s+of|in\s+the\s+case\s+of)\s*$/i;
const NESTING_CUE = /(?:^|\b)(?:any|each|following|include|includes|including|means|consists\s+of|consisting\s+of|to\s+any|which)\s*$/i;
const QUALIFICATION_PATTERN = /\b(?:provided\s*,?\s*(?:however\s*,?\s*)?that|provided\s+further\s+that|subject\s+to|except\s*,?\s*(?:in\s+the\s+case\s+of|that|for)|unless|notwithstanding|in\s+the\s+case\s+of)\b/ig;

function alphaValue(label) {
  if (/^[a-z]$/.test(label)) return label.charCodeAt(0) - 97;
  if (/^[a-z]{2}$/.test(label) && label[0] === label[1]) {
    return 26 + label.charCodeAt(0) - 97;
  }
  return null;
}

function alphaLabel(value, upper) {
  let label = null;
  if (value >= 0 && value < 26) label = String.fromCharCode(97 + value);
  if (value >= 26 && value < 52) {
    const character = String.fromCharCode(97 + value - 26);
    label = `${character}${character}`;
  }
  return upper && label ? label.toUpperCase() : label;
}

function styleLabel(style, value) {
  if (style === 'romanLower') return ROMAN_LABELS[value] || null;
  if (style === 'romanUpper') return (ROMAN_LABELS[value] || '').toUpperCase() || null;
  if (style === 'alphaLower') return alphaLabel(value, false);
  if (style === 'alphaUpper') return alphaLabel(value, true);
  if (style === 'digit') return String(value + 1);
  if (style === 'xyz') return ['x', 'y', 'z'][value] || null;
  return null;
}

function firstStyles(label) {
  const styles = [];
  if (label === 'i') styles.push('romanLower');
  if (label === 'I') styles.push('romanUpper');
  if (label === 'a') styles.push('alphaLower');
  if (label === 'A') styles.push('alphaUpper');
  if (label === '1') styles.push('digit');
  if (label === 'x') styles.push('xyz');
  return styles;
}

function markerStyleValues(label) {
  const values = [];
  if (ROMAN_INDEX.has(label)) {
    values.push({ style: 'romanLower', value: ROMAN_INDEX.get(label) });
  }
  const lower = alphaValue(label);
  if (lower !== null) values.push({ style: 'alphaLower', value: lower });
  const lowerUpper = alphaValue(label.toLowerCase());
  if (/^[A-Z]{1,2}$/.test(label) && lowerUpper !== null) {
    values.push({ style: 'alphaUpper', value: lowerUpper });
  }
  const upperRoman = label.toLowerCase();
  if (/^[IVX]+$/.test(label) && ROMAN_INDEX.has(upperRoman)) {
    values.push({ style: 'romanUpper', value: ROMAN_INDEX.get(upperRoman) });
  }
  if (/^[0-9]{1,3}$/.test(label)) {
    values.push({ style: 'digit', value: Number(label) - 1 });
  }
  if (Object.hasOwn({ x: 0, y: 1, z: 2 }, label)) {
    values.push({ style: 'xyz', value: { x: 0, y: 1, z: 2 }[label] });
  }
  return values;
}

function substantivePayload(value) {
  const words = String(value).replace(MARKER_PATTERN, ' ')
    .match(/[A-Za-z][A-Za-z'-]*/g) || [];
  return words.some((word) => !STOP_WORDS.has(word.toLowerCase()));
}

function startsLine(text, index) {
  const newline = text.lastIndexOf('\n', index - 1);
  return /^\s*$/u.test(text.slice(newline < 0 ? 0 : newline + 1, index));
}

function colonIntroduced(text, index) {
  let cursor = index - 1;
  while (cursor >= 0 && /\s/u.test(text[cursor])) cursor -= 1;
  return cursor >= 0 && text[cursor] === ':';
}

function sequenceSignal(text, first, second) {
  const between = text.slice(first.end, second.start);
  return colonIntroduced(text, first.start)
    || startsLine(text, first.start)
    || /(?:[,;:]|\b(?:and|or|plus|minus)|\b(?:multiplied|divided)\s+by)\s*$/iu
      .test(between);
}

function directPayloadEnd(text, start, end) {
  const local = text.slice(start, end);
  for (let index = 0; index < local.length; index += 1) {
    if (local[index] === ';') return start + index;
    if (local[index] !== '.') continue;
    if (/\d/u.test(local[index - 1] || '') && /\d/u.test(local[index + 1] || '')) continue;
    return start + index;
  }
  return end;
}

function qualificationStart(text, start, end, finalItemLabel) {
  QUALIFICATION_PATTERN.lastIndex = 0;
  const local = text.slice(start, end);
  let match;
  while ((match = QUALIFICATION_PATTERN.exec(local)) !== null) {
    const absolute = start + match.index;
    let cursor = absolute - 1;
    while (cursor >= start && /\s/u.test(text[cursor])) cursor -= 1;
    const phrase = match[0].toLowerCase();
    const localTail = text.slice(absolute, Math.min(end, absolute + 220));
    const escapedLabel = String(finalItemLabel || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (escapedLabel && new RegExp(
      `\\b(?:this|such)\\s+clause\\s+\\(${escapedLabel}\\)(?:\\s+only)?\\b`,
      'iu',
    ).test(localTail)) continue;
    if (text[cursor] === ';' || (text[cursor] === ',' && phrase.startsWith('in the case of'))) {
      return absolute;
    }
  }
  return null;
}

function nestingCue(text, rangeStart, markerStart) {
  if (colonIntroduced(text, markerStart)) return true;
  const prefix = text.slice(Math.max(rangeStart, markerStart - 64), markerStart);
  return NESTING_CUE.test(prefix);
}

function sentenceBoundary(text, start, end) {
  const local = text.slice(start, end);
  const match = /[.!?][”’"')\]]*(?=\s+[A-Z“"'(])/u.exec(local);
  return match ? start + match.index + match[0].length : null;
}

function tokenise(text) {
  const tokens = [];
  MARKER_PATTERN.lastIndex = 0;
  let match;
  while ((match = MARKER_PATTERN.exec(text)) !== null) {
    const start = match.index;
    const previous = text[start - 1] || '';
    const prefix = text.slice(Math.max(0, start - 180), start);
    let referenceReason = null;
    if (start > 0 && !(/\s/u.test(previous) || [',', ';', ':'].includes(previous))) {
      referenceReason = 'GLUED_SECTION_REFERENCE';
    } else {
      const referenceLead = REFERENCE_LEAD.exec(prefix);
      if (referenceLead) {
        referenceReason = 'BARE_CLAUSE_REFERENCE';
      }
    }
    tokens.push({
      label: match[1],
      start,
      end: start + match[0].length,
      reference_reason: referenceReason,
    });
  }
  for (let index = 0; index < tokens.length; index += 1) {
    const first = tokens[index];
    if (first.reference_reason) continue;
    const prefix = text.slice(Math.max(0, first.start - 80), first.start);
    if (!REFERENCE_PAIR_LEAD.test(prefix)) continue;
    const firstStylesAndValues = markerStyleValues(first.label);
    const second = tokens.slice(index + 1).find((candidate) =>
      candidate.start - first.end <= 80
        && firstStylesAndValues.some(({ style, value }) =>
          styleLabel(style, value + 1) === candidate.label));
    if (!second || substantivePayload(text.slice(first.end, second.start))) continue;
    first.reference_reason = 'BARE_CLAUSE_REFERENCE';
  }
  for (let anchorIndex = 0; anchorIndex < tokens.length; anchorIndex += 1) {
    const anchor = tokens[anchorIndex];
    if (anchor.reference_reason !== 'BARE_CLAUSE_REFERENCE') continue;
    let activeStyles = markerStyleValues(anchor.label);
    let previous = anchor;
    for (let index = anchorIndex + 1; index < tokens.length; index += 1) {
      const candidate = tokens[index];
      if (candidate.start - anchor.end > 180) break;
      const between = text.slice(previous.end, candidate.start);
      if (/[.;:]/u.test(between)) break;
      if (substantivePayload(between)) break;
      let continuedStyles = activeStyles
        .filter(({ style, value }) => styleLabel(style, value + 1) === candidate.label)
        .map(({ style, value }) => ({ style, value: value + 1 }));
      if (continuedStyles.length === 0
        && /^\s*(?:-|–|—|through|to)\s*$/iu.test(between)) {
        const candidateStyles = markerStyleValues(candidate.label);
        continuedStyles = activeStyles.filter(({ style, value }) =>
          candidateStyles.some((candidateStyle) =>
            candidateStyle.style === style && candidateStyle.value > value))
          .map(({ style }) => candidateStyles.find((candidateStyle) =>
            candidateStyle.style === style));
      }
      if (continuedStyles.length === 0) continue;
      candidate.reference_reason = 'BARE_CLAUSE_REFERENCE';
      activeStyles = continuedStyles;
      previous = candidate;
    }
  }
  return tokens;
}

function makeDisposition(disposition, reason, style, depth, tokens) {
  return {
    disposition,
    reason,
    style: style || 'UNCLASSIFIED',
    depth: Number.isInteger(depth) ? depth : null,
    marker_offsets: tokens.map((token) => ({
      start: token.start,
      end: token.end,
      label: token.label,
    })),
    produced_item_offsets: [],
  };
}

function segmentAuthoredInlineLists(input, options = {}) {
  const text = String(input || '');
  const maximumDepth = options.maximumDepth === undefined
    ? MAX_INLINE_DEPTH
    : options.maximumDepth;
  if (!Number.isInteger(maximumDepth) || maximumDepth < 1 || maximumDepth > MAX_INLINE_DEPTH) {
    throw new TypeError('maximumDepth must be an integer from 1 to 5');
  }

  const tokens = tokenise(text);
  const acceptedStarts = new Set();
  const disposedStarts = new Set();
  const lists = [];
  const qualificationBlocks = [];
  const markerDispositions = [];
  const diagnostics = [];

  function dynamicallyEligible(token) {
    if (token.reference_reason === 'GLUED_SECTION_REFERENCE') {
      const prior = tokens.find((candidate) => candidate.end === token.start);
      return Boolean(prior && acceptedStarts.has(prior.start));
    }
    return true;
  }

  function effectiveReferenceReason(token) {
    if (token.reference_reason !== 'GLUED_SECTION_REFERENCE') return token.reference_reason;
    const prior = tokens.find((candidate) => candidate.end === token.start);
    return prior && acceptedStarts.has(prior.start) ? null : token.reference_reason;
  }

  function hasEffectiveReferenceReason(token) {
    return Boolean(effectiveReferenceReason(token));
  }

  function availableTokens(start, end) {
    return tokens.filter((token) => token.start >= start
      && token.end <= end
      && !disposedStarts.has(token.start)
      && dynamicallyEligible(token));
  }

  function valueForStyle(token, style, expectedValue = null) {
    const matched = markerStyleValues(token.label)
      .find((candidate) => candidate.style === style);
    if (!matched) return null;
    const expectedLabel = expectedValue === null
      ? null
      : styleLabel(style, expectedValue);
    const distinctInitialStyle = firstStyles(token.label)
      .some((candidateStyle) => candidateStyle !== style);
    const lowerRomanOrXyz = style === 'alphaLower'
      && (ROMAN_INDEX.has(token.label) || ['x', 'y', 'z'].includes(token.label));
    const upperRoman = style === 'alphaUpper'
      && /^[IVX]+$/u.test(token.label)
      && ROMAN_INDEX.has(token.label.toLowerCase());
    if ((distinctInitialStyle || lowerRomanOrXyz || upperRoman)
      && token.label !== expectedLabel) return null;
    return matched.value;
  }

  function startsProvenAlternativeList(rangeTokens, token, activeStyle, rangeStart) {
    const provedNestingCue = nestingCue(text, rangeStart, token.start);
    const laterLineStartDuplicate = rangeTokens.some((candidate) =>
      candidate.start > token.start
        && candidate.label === token.label
        && startsLine(text, candidate.start)
        && !hasEffectiveReferenceReason(candidate));
    if (!provedNestingCue && !laterLineStartDuplicate) return false;
    for (const style of firstStyles(token.label)) {
      if (style === activeStyle) continue;
      const secondLabel = styleLabel(style, 1);
      const second = rangeTokens.find((candidate) => candidate.start > token.start
        && candidate.label === secondLabel
        && !hasEffectiveReferenceReason(candidate));
      if (second
        && substantivePayload(text.slice(token.end, second.start))
        && sequenceSignal(text, token, second)) return true;
    }
    return false;
  }

  function corroboratedPair(rangeTokens, position, style) {
    const first = rangeTokens[position];
    const later = rangeTokens.slice(position + 1)
      .filter((token) => !hasEffectiveReferenceReason(token))
      .map((token) => ({ token, value: valueForStyle(token, style, 1) }))
      .filter((entry) => entry.value !== null)
      .filter((entry) => entry.value === 0
        || entry.value === 1
        || sequenceSignal(text, first, entry.token));
    if (later.length === 0) return null;

    const firstLater = later[0];
    if (firstLater.value === 1) return { first, second: firstLater.token };

    if (firstLater.value === 0) {
      const nestedStart = firstLater.token;
      if (!nestingCue(text, first.end, nestedStart.start)) {
        const restartedSecond = later.find((entry, index) => index > 0 && entry.value === 1);
        return restartedSecond ? {
          conflictReason: 'AMBIGUOUS_SAME_STYLE_RESTART',
          conflictTokens: [first, nestedStart, restartedSecond.token],
        } : null;
      }
      let nestedExpected = 1;
      let index = 1;
      while (index < later.length && later[index].value === nestedExpected) {
        nestedExpected += 1;
        index += 1;
      }
      const outerSecond = later[index];
      if (outerSecond?.value === 1) return { first, second: outerSecond.token };
      return {
        conflictReason: 'AMBIGUOUS_SAME_STYLE_RESTART',
        conflictTokens: [
          first,
          ...later.slice(0, outerSecond ? index + 1 : index).map((entry) => entry.token),
        ],
      };
    }

    const laterSecond = later.find((entry) => entry.value === 1);
    if (!laterSecond) return null;
    return {
      conflictReason: 'OUT_OF_ORDER_MARKER_SEQUENCE',
      conflictTokens: [
        first,
        ...later.slice(0, later.indexOf(laterSecond) + 1).map((entry) => entry.token),
      ],
    };
  }

  function findCandidate(start, end) {
    const rangeTokens = availableTokens(start, end);
    for (let position = 0; position < rangeTokens.length; position += 1) {
      const first = rangeTokens[position];
      if (hasEffectiveReferenceReason(first)) continue;
      for (const style of firstStyles(first.label)) {
        const pair = corroboratedPair(rangeTokens, position, style);
        if (!pair) continue;
        if (pair.conflictReason) return { ...pair, style, rangeTokens };
        if (!substantivePayload(text.slice(pair.first.end, pair.second.start))) continue;
        if (!sequenceSignal(text, pair.first, pair.second)) continue;
        return { ...pair, style, rangeTokens };
      }
    }
    return null;
  }

  function collectSiblings(candidate, start, end) {
    const siblings = [candidate.first, candidate.second];
    let expectedValue = 2;
    while (true) {
      const expectedLabel = styleLabel(candidate.style, expectedValue);
      if (!expectedLabel) break;
      const later = candidate.rangeTokens
        .filter((token) => token.start > siblings.at(-1).start
          && token.start < end
          && !hasEffectiveReferenceReason(token))
        .filter((token) => !startsProvenAlternativeList(
          candidate.rangeTokens,
          token,
          candidate.style,
          siblings.at(-1).end,
        ))
        .map((token) => ({
          token,
          value: valueForStyle(token, candidate.style, expectedValue),
        }))
        .filter((entry) => entry.value !== null)
        .filter((entry) => entry.value === 0
          || entry.value === expectedValue
          || sequenceSignal(text, siblings.at(-1), entry.token));
      const firstLater = later[0];
      if (!firstLater || firstLater.value === 0) break;
      if (firstLater.value !== expectedValue) {
        return {
          siblings,
          conflictReason: 'OUT_OF_ORDER_MARKER_SEQUENCE',
          conflictTokens: [...siblings, ...later.map((entry) => entry.token)],
          ambiguousRestart: null,
          separateRestart: null,
        };
      }
      const next = firstLater.token;
      if (!substantivePayload(text.slice(siblings.at(-1).end, next.start))) break;
      siblings.push(next);
      expectedValue += 1;
    }

    const restart = candidate.rangeTokens.find((token) =>
      token.start > siblings.at(-1).start
        && token.start < end
        && token.label === candidate.first.label
        && !hasEffectiveReferenceReason(token));
    if (restart) {
      const secondLabel = styleLabel(candidate.style, 1);
      const restartedSecond = candidate.rangeTokens.find((token) =>
        token.start > restart.start && token.start < end
          && token.label === secondLabel && !hasEffectiveReferenceReason(token));
      if (restartedSecond && !nestingCue(text, siblings.at(-1).end, restart.start)) {
        const boundary = sentenceBoundary(text, siblings.at(-1).end, restart.start);
        if (boundary !== null) {
          return {
            siblings,
            ambiguousRestart: null,
            separateRestart: { restart, boundary },
          };
        }
        return {
          siblings,
          ambiguousRestart: [restart, restartedSecond],
          separateRestart: null,
        };
      }
    }
    return {
      siblings,
      conflictReason: null,
      conflictTokens: [],
      ambiguousRestart: null,
      separateRestart: null,
    };
  }

  function disposeUnresolved(reason, style, depth, dispositionTokens) {
    for (const token of dispositionTokens) disposedStarts.add(token.start);
    const disposition = makeDisposition(
      'UNRESOLVED_INLINE_LIST',
      reason,
      style,
      depth,
      dispositionTokens,
    );
    markerDispositions.push(disposition);
    diagnostics.push({
      diagnostic_type: 'UNRESOLVED_INLINE_MARKER_BOUNDARY',
      reason,
      start: dispositionTokens[0].start,
      end: dispositionTokens.at(-1).end,
    });
  }

  function parseRange(start, end, depth) {
    const candidate = findCandidate(start, end);
    if (!candidate) return { lists: [], qualifications: [] };
    if (candidate.conflictReason) {
      disposeUnresolved(
        candidate.conflictReason,
        candidate.style,
        depth,
        candidate.conflictTokens,
      );
      return { lists: [], qualifications: [] };
    }
    const {
      siblings,
      conflictReason,
      conflictTokens,
      ambiguousRestart,
      separateRestart,
    } = collectSiblings(
      candidate,
      start,
      end,
    );
    if (conflictReason) {
      disposeUnresolved(conflictReason, candidate.style, depth, conflictTokens);
      return { lists: [], qualifications: [] };
    }
    if (ambiguousRestart) {
      disposeUnresolved(
        'AMBIGUOUS_SAME_STYLE_RESTART',
        candidate.style,
        depth,
        [...siblings, ...ambiguousRestart],
      );
      return { lists: [], qualifications: [] };
    }
    if (depth > maximumDepth) {
      const blocked = availableTokens(candidate.first.start, end)
        .filter((token) => !hasEffectiveReferenceReason(token));
      disposeUnresolved('DEPTH_LIMIT', candidate.style, depth, blocked);
      return { lists: [], qualifications: [] };
    }

    const last = siblings.at(-1);
    const sequenceEnd = separateRestart ? separateRestart.boundary : end;
    const trailingQualificationStart = qualificationStart(
      text,
      last.end,
      sequenceEnd,
      last.label,
    );
    const listEnd = trailingQualificationStart === null
      ? sequenceEnd
      : trailingQualificationStart;
    const finalPayloadEnd = directPayloadEnd(text, last.end, listEnd);
    if (!substantivePayload(text.slice(last.end, finalPayloadEnd))) {
      disposeUnresolved(
        'INSUFFICIENT_ITEM_PAYLOAD',
        candidate.style,
        depth,
        siblings,
      );
      return { lists: [], qualifications: [] };
    }

    const chapeauText = text.slice(start, candidate.first.start);
    const firstVisible = /\S/u.exec(chapeauText);
    const list = {
      style: candidate.style,
      depth,
      start: candidate.first.start,
      end: listEnd,
      chapeau: firstVisible
        ? { start: start + firstVisible.index, end: candidate.first.start }
        : null,
      items: [],
      trailing_qualification: null,
    };
    for (let index = 0; index < siblings.length; index += 1) {
      const marker = siblings[index];
      const itemEnd = siblings[index + 1]?.start || listEnd;
      acceptedStarts.add(marker.start);
      disposedStarts.add(marker.start);
      list.items.push({
        label: marker.label,
        start: marker.start,
        end: itemEnd,
        marker_start: marker.start,
        marker_end: marker.end,
        child_list: null,
        child_lists: [],
        qualification_blocks: [],
      });
    }

    const accepted = makeDisposition(
      'AUTHORED_INLINE_LIST',
      'CORROBORATED_SUBSTANTIVE_SEQUENCE',
      candidate.style,
      depth,
      siblings,
    );
    accepted.produced_item_offsets = list.items.map((item) => ({
      start: item.start,
      end: item.end,
      label: item.label,
    }));
    markerDispositions.push(accepted);
    lists.push(list);

    for (const item of list.items) {
      const childResult = parseRange(item.marker_end, item.end, depth + 1);
      item.child_lists = childResult.lists;
      item.child_list = childResult.lists[0] || null;
      item.qualification_blocks = childResult.qualifications;
    }

    const qualifications = [];
    if (trailingQualificationStart !== null) {
      const childResult = parseRange(trailingQualificationStart, sequenceEnd, depth);
      const qualification = {
        start: trailingQualificationStart,
        end: sequenceEnd,
        child_lists: childResult.lists,
        qualification_blocks: childResult.qualifications,
      };
      list.trailing_qualification = qualification;
      qualificationBlocks.push(qualification);
      qualifications.push(qualification);
    }
    if (separateRestart) {
      const remainder = parseRange(separateRestart.boundary, end, depth);
      return {
        lists: [list, ...remainder.lists],
        qualifications: [...qualifications, ...remainder.qualifications],
      };
    }
    return { lists: [list], qualifications };
  }

  const rootResult = parseRange(0, text.length, 1);

  for (const token of tokens) {
    if (disposedStarts.has(token.start)) continue;
    let disposition;
    const referenceReason = effectiveReferenceReason(token);
    if (referenceReason) {
      disposition = makeDisposition(
        'NON_STRUCTURAL_MARKER',
        referenceReason,
        'UNCLASSIFIED',
        null,
        [token],
      );
    } else {
      disposition = makeDisposition(
        'NON_STRUCTURAL_MARKER',
        firstStyles(token.label).length > 0
          ? 'UNCORROBORATED_FIRST_MARKER'
          : 'AMBIGUOUS_MARKER_STYLE',
        'UNCLASSIFIED',
        null,
        [token],
      );
    }
    disposedStarts.add(token.start);
    markerDispositions.push(disposition);
  }

  markerDispositions.sort((left, right) =>
    left.marker_offsets[0].start - right.marker_offsets[0].start
      || left.disposition.localeCompare(right.disposition));
  diagnostics.sort((left, right) => left.start - right.start
    || left.reason.localeCompare(right.reason));

  return {
    schema_version: INLINE_STRUCTURE_SCHEMA_VERSION,
    parser_version: INLINE_STRUCTURE_PARSER_VERSION,
    coordinate_system: OFFSET_COORDINATE_SYSTEM,
    maximum_depth: maximumDepth,
    candidate_markers: tokens.map((token) => ({
      start: token.start,
      end: token.end,
      label: token.label,
    })),
    root_list: rootResult.lists[0] || null,
    root_lists: rootResult.lists,
    root_qualification_blocks: rootResult.qualifications,
    lists,
    qualification_blocks: qualificationBlocks,
    marker_dispositions: markerDispositions,
    diagnostics,
  };
}

module.exports = {
  INLINE_STRUCTURE_SCHEMA_VERSION,
  INLINE_STRUCTURE_PARSER_VERSION,
  OFFSET_COORDINATE_SYSTEM,
  MAX_INLINE_DEPTH,
  segmentAuthoredInlineLists,
};
