const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');
const { buildLayers } = require('../parser-v2/text-layers');

const SOURCE_TRANSFORM = 'PARSER_V2_TEXT_LAYERS/V1';
const AUTHORITY_SCOPE =
  'OFFLINE_QXO_CAPITALISATION_PARSER_SOURCE_CLOSURE_F27_ONLY';
const MAX_CLOSURE_BYTES = 256 * 1024;

const COMPANY_EQUITY_RIGHTS_CONTINUITY_TEXT =
  '(the items referred to in clauses (B) and (C) of or with respect to any Person, collectively,\n\n'
  + '"Company Equity Rights"), and no such Company Equity Rights are authorized, issued or outstanding.';

const INLINE_NUMBER_TOKENS = Object.freeze([
  '250,000,000',
  '28,142,327',
  '119,994',
  '10,000,000',
  '$0.01',
  '1,600,514',
  '54,756',
  '$96.60',
  '44,526',
  '75,468',
]);

const PARTY_TOKENS = Object.freeze([
  'Parent',
  'Titanium Merger Sub',
  'Forward Merger Sub',
]);
const BUYER_GROUP_PARTY_TEXT =
  'Parent, Titanium Merger Sub and Forward Merger Sub';
const REPRESENTATION_LIMB_STARTS = Object.freeze([
  '(i)The authorized capital stock of the Company consists of',
  '(ii)As of April 17, 2026,',
  '(iii)Except for any obligations pursuant to this Agreement,',
  '(iv)Upon any issuance of any Company Shares in accordance with the terms of the A&R 2015 Plan,',
  '(v)There are no voting trusts or other agreements or understandings',
]);

const CLAUSE_B_TEXT =
  '(B) the representations and warranties of the Company set forth in Section 3.1(b)(i) '
  + 'and Section 3.1(b)(iii) (Capital Structure) shall be true and correct at and as of '
  + 'the date of this Agreement and the Closing Date as though made at and as of the '
  + 'Closing Date except for De Minimis Inaccuracies,';

const CLAUSE_C_TEXT =
  '(C) the representations and warranties of the Company set forth in Section 3.1(a) '
  + '(Organization, Good Standing and Qualification), Section 3.1(b) (Capital Structure) '
  + '(other than Section 3.1(b)(i) and Section 3.1(b)(iii) thereof), Section 3.1(c) '
  + '(Corporate Authority and Approval) and Section 3.1(s) (Brokers and Finders) shall '
  + 'be true and correct (disregarding all qualifications or limitations as to "material", '
  + '"materiality" or "Company Material Adverse Effect") in all material respects at and '
  + 'as of the date of this Agreement and the Closing Date as though made at and as of '
  + 'the Closing Date ';

const DATED_REPRESENTATION_PROVISO_TEXT =
  'provided, however, that, with respect to clauses (A), (B), (C) and (D) above, '
  + 'representations and warranties that are made as of a particular date or period shall '
  + 'be true and correct (in the manner set forth in clause (A), (B), (C) or (D), as '
  + 'applicable) only as of such date or period.';

const DE_MINIMIS_DEFINITION_TEXT =
  'For purposes of this Agreement, "De Minimis Inaccuracies" means any inaccuracies that '
  + 'individually or in the aggregate are de minimis relative to the total fully diluted '
  + 'equity capitalization of the Company or Parent, as the case may be;';

class QxoCapitalisationParserSourceClosureF27Error extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'QxoCapitalisationParserSourceClosureF27Error';
    this.code = code;
  }
}

function fail(code, message) {
  throw new QxoCapitalisationParserSourceClosureF27Error(code, message);
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function normalizeProjectedCharacter(character) {
  if (character === '\u00a0' || character === '\u202f') return ' ';
  if (/[\u201c\u201d]/.test(character)) return '"';
  if (/[\u2018\u2019]/.test(character)) return "'";
  return character;
}

function byteOffset(text, characterOffset) {
  return Buffer.byteLength(text.slice(0, characterOffset), 'utf8');
}

function buildProjection(sourceKey, rawText) {
  const layers = buildLayers(rawText);
  const mappingCount = layers.cleanText.length + 1;
  const encoded = Buffer.allocUnsafe(mappingCount * 4);
  let prior = -1;

  for (let cleanOffset = 0; cleanOffset < mappingCount; cleanOffset += 1) {
    const sourceOffset = layers.mapCleanToRaw(cleanOffset);
    if (!Number.isInteger(sourceOffset)
      || sourceOffset < prior
      || sourceOffset > rawText.length
      || sourceOffset > 0xffffffff) {
      fail('NON_MONOTONE_SOURCE_PROJECTION', `${sourceKey} projection is not monotone`);
    }
    if (cleanOffset < layers.cleanText.length
      && normalizeProjectedCharacter(rawText[sourceOffset])
        !== layers.cleanText[cleanOffset]) {
      fail('INEXACT_SOURCE_PROJECTION', `${sourceKey} projection does not round-trip`);
    }
    encoded.writeUInt32BE(sourceOffset, cleanOffset * 4);
    prior = sourceOffset;
  }
  if (layers.mapCleanToRaw(layers.cleanText.length) !== rawText.length) {
    fail('INCOMPLETE_SOURCE_PROJECTION', `${sourceKey} projection does not reach source end`);
  }

  return {
    layers,
    binding: freeze({
      schema_version: 'QXO_F27_PARSER_SOURCE_BINDING/V1',
      source_key: sourceKey,
      source_transform: SOURCE_TRANSFORM,
      raw_text_sha256: sha256Hex(Buffer.from(rawText, 'utf8')),
      raw_text_byte_length: Buffer.byteLength(rawText, 'utf8'),
      raw_text_character_length: rawText.length,
      clean_text_sha256: sha256Hex(Buffer.from(layers.cleanText, 'utf8')),
      clean_text_byte_length: Buffer.byteLength(layers.cleanText, 'utf8'),
      clean_text_character_length: layers.cleanText.length,
      mapping_count: mappingCount,
      clean_to_source_map_sha256: sha256Hex(encoded),
      monotone_projection_verified: true,
      exact_round_trip_verified: true,
    }),
  };
}

function sourceSegments(rawText, layers, cleanStart, cleanEnd) {
  const segments = [];
  let runCleanStart = cleanStart;
  let runSourceStart = layers.mapCleanToRaw(cleanStart);
  let priorSourceOffset = runSourceStart - 1;

  function flush(runCleanEnd, runSourceEnd) {
    const exactSourceText = rawText.slice(runSourceStart, runSourceEnd);
    const projectedCleanText = layers.cleanText.slice(runCleanStart, runCleanEnd);
    segments.push(freeze({
      source_character_start: runSourceStart,
      source_character_end: runSourceEnd,
      source_byte_start: byteOffset(rawText, runSourceStart),
      source_byte_end: byteOffset(rawText, runSourceEnd),
      exact_source_text: exactSourceText,
      exact_source_text_sha256: sha256Hex(Buffer.from(exactSourceText, 'utf8')),
      projected_clean_text: projectedCleanText,
      projected_clean_text_sha256:
        sha256Hex(Buffer.from(projectedCleanText, 'utf8')),
    }));
  }

  for (let cleanOffset = cleanStart; cleanOffset < cleanEnd; cleanOffset += 1) {
    const sourceOffset = layers.mapCleanToRaw(cleanOffset);
    if (cleanOffset > cleanStart && sourceOffset !== priorSourceOffset + 1) {
      flush(cleanOffset, priorSourceOffset + 1);
      runCleanStart = cleanOffset;
      runSourceStart = sourceOffset;
    }
    priorSourceOffset = sourceOffset;
  }
  flush(cleanEnd, priorSourceOffset + 1);
  return freeze(segments);
}

function anchorInterval(sourceKey, rawText, layers, cleanStart, cleanEnd, label) {
  if (!Number.isInteger(cleanStart)
    || !Number.isInteger(cleanEnd)
    || cleanStart < 0
    || cleanEnd <= cleanStart
    || cleanEnd > layers.cleanText.length) {
    fail('INVALID_CLEAN_INTERVAL', `${label} has an invalid clean-text interval`);
  }
  const exactCleanText = layers.cleanText.slice(cleanStart, cleanEnd);
  const segments = sourceSegments(rawText, layers, cleanStart, cleanEnd);
  if (segments.map((segment) => segment.projected_clean_text).join('')
    !== exactCleanText) {
    fail('INEXACT_ANCHOR_PROJECTION', `${label} does not reconstruct clean text`);
  }
  const body = {
    schema_version: 'QXO_F27_EXACT_PARSER_SOURCE_ANCHOR/V1',
    source_key: sourceKey,
    label,
    parser_clean_start: cleanStart,
    parser_clean_end: cleanEnd,
    exact_clean_text: exactCleanText,
    exact_clean_text_sha256: sha256Hex(Buffer.from(exactCleanText, 'utf8')),
    source_segments: segments,
  };
  return freeze({
    ...body,
    exact_parser_source_anchor_id:
      contentId('QXO_F27_EXACT_PARSER_SOURCE_ANCHOR/V1', body),
  });
}

function anchorExactText(sourceKey, rawText, layers, exactText, label) {
  const cleanStart = layers.cleanText.indexOf(exactText);
  if (cleanStart < 0
    || layers.cleanText.indexOf(exactText, cleanStart + 1) >= 0) {
    fail('EXACT_TEXT_NOT_UNIQUE', `${label} is absent or not unique`);
  }
  return anchorInterval(
    sourceKey,
    rawText,
    layers,
    cleanStart,
    cleanStart + exactText.length,
    label,
  );
}

function pageMarkerDisposition(rawText, cleanText) {
  const matches = [...rawText.matchAll(/^16$/gm)];
  if (matches.length !== 1 || /(^|\n)16(?=\n|$)/.test(cleanText)) {
    fail('PAGE_MARKER_DISPOSITION_FAILED', 'standalone page 16 was not removed exactly once');
  }
  const sourceCharacterStart = matches[0].index;
  const sourceCharacterEnd = sourceCharacterStart + matches[0][0].length;
  return freeze({
    schema_version: 'QXO_F27_PAGE_MARKER_DISPOSITION/V1',
    source_key: 'SECTION_3_1_B',
    exact_source_text: '16',
    source_character_start: sourceCharacterStart,
    source_character_end: sourceCharacterEnd,
    source_byte_start: byteOffset(rawText, sourceCharacterStart),
    source_byte_end: byteOffset(rawText, sourceCharacterEnd),
    parser_clean_occurrence_count: 0,
    disposition: 'EXCLUDED_AS_STANDALONE_PAGE_MARKER',
  });
}

function conditionSubsectionInterval(cleanText) {
  const start = cleanText.indexOf('(ii)(A) ');
  const terminal = '\n\n(iii)';
  const end = cleanText.indexOf(terminal, start);
  if (start < 0 || end < 0) {
    fail('CONDITION_SUBSECTION_UNRESOLVED', 'section 5.2(a)(ii) is not exactly delimited');
  }
  return { start, end };
}

function buildQxoCapitalisationParserSourceClosureF27({
  capital_structure_text: capitalStructureText,
  closing_condition_text: closingConditionText,
} = {}) {
  if (typeof capitalStructureText !== 'string' || !capitalStructureText
    || typeof closingConditionText !== 'string' || !closingConditionText) {
    fail('SOURCE_TEXT_REQUIRED', 'both QXO source texts are required');
  }

  const capital = buildProjection('SECTION_3_1_B', capitalStructureText);
  const condition = buildProjection('SECTION_5_2', closingConditionText);
  const conditionInterval = conditionSubsectionInterval(condition.layers.cleanText);
  const pageMarker = pageMarkerDisposition(
    capitalStructureText,
    capital.layers.cleanText,
  );
  const sectionBindings = freeze([
    anchorInterval(
      'SECTION_3_1_B',
      capitalStructureText,
      capital.layers,
      0,
      capital.layers.cleanText.length,
      'SECTION_3_1_B_CAPITAL_STRUCTURE',
    ),
    anchorInterval(
      'SECTION_5_2',
      closingConditionText,
      condition.layers,
      conditionInterval.start,
      conditionInterval.end,
      'SECTION_5_2_A_II_ACCURACY_CONDITIONS',
    ),
  ]);
  const companyEquityRightsContinuity = anchorExactText(
    'SECTION_3_1_B',
    capitalStructureText,
    capital.layers,
    COMPANY_EQUITY_RIGHTS_CONTINUITY_TEXT,
    'COMPANY_EQUITY_RIGHTS_CONTINUITY',
  );
  if (companyEquityRightsContinuity.source_segments.length < 2) {
    fail(
      'PAGE_BREAK_PROJECTION_NOT_PRESERVED',
      'Company Equity Rights must retain its discontiguous source projection',
    );
  }
  const representationLimbStarts = REPRESENTATION_LIMB_STARTS.map(
    (token, index) => {
      const start = capital.layers.cleanText.indexOf(token);
      if (start < 0
        || capital.layers.cleanText.indexOf(token, start + 1) >= 0) {
        fail(
          'REPRESENTATION_LIMB_UNRESOLVED',
          `Section 3.1(b) limb ${index + 1} is absent or not unique`,
        );
      }
      return start;
    },
  );
  const representationLimbBindings = freeze(
    representationLimbStarts.map((start, index) => anchorInterval(
      'SECTION_3_1_B',
      capitalStructureText,
      capital.layers,
      start,
      representationLimbStarts[index + 1]
        ?? capital.layers.cleanText.length,
      `SECTION_3_1_B_LIMB_${index + 1}`,
    )),
  );
  const representationChapeauBinding = anchorInterval(
    'SECTION_3_1_B',
    capitalStructureText,
    capital.layers,
    0,
    representationLimbStarts[0],
    'SECTION_3_1_B_CHAPEAU',
  );

  const ordinaryInlineNumberBindings = freeze(INLINE_NUMBER_TOKENS.map(
    (token) => anchorExactText(
      'SECTION_3_1_B',
      capitalStructureText,
      capital.layers,
      token,
      `INLINE_NUMBER_${token}`,
    ),
  ));
  const buyerGroupPartyStart = condition.layers.cleanText.indexOf(
    BUYER_GROUP_PARTY_TEXT,
  );
  if (buyerGroupPartyStart < 0) {
    fail('BUYER_GROUP_PARTIES_UNRESOLVED', 'exact buyer-group party text is absent');
  }
  const partyTokenBindings = freeze(PARTY_TOKENS.map((token) => {
    const tokenStart = buyerGroupPartyStart + BUYER_GROUP_PARTY_TEXT.indexOf(token);
    return anchorInterval(
      'SECTION_5_2',
      closingConditionText,
      condition.layers,
      tokenStart,
      tokenStart + token.length,
      `BUYER_GROUP_PARTY_${token.toUpperCase().replaceAll(' ', '_')}`,
    );
  }));
  const conditionClauseBindings = freeze([
    anchorExactText(
      'SECTION_5_2',
      closingConditionText,
      condition.layers,
      CLAUSE_B_TEXT,
      'SECTION_5_2_A_II_CLAUSE_B',
    ),
    anchorExactText(
      'SECTION_5_2',
      closingConditionText,
      condition.layers,
      CLAUSE_C_TEXT,
      'SECTION_5_2_A_II_CLAUSE_C',
    ),
    anchorExactText(
      'SECTION_5_2',
      closingConditionText,
      condition.layers,
      DATED_REPRESENTATION_PROVISO_TEXT,
      'SECTION_5_2_A_II_DATED_REPRESENTATION_PROVISO',
    ),
    anchorExactText(
      'SECTION_5_2',
      closingConditionText,
      condition.layers,
      DE_MINIMIS_DEFINITION_TEXT,
      'DE_MINIMIS_INACCURACIES_DEFINITION',
    ),
  ]);

  const body = {
    schema_version: 'QXO_CAPITALISATION_PARSER_SOURCE_CLOSURE_F27/V1',
    authority_scope: AUTHORITY_SCOPE,
    source_transform: SOURCE_TRANSFORM,
    source_bindings: freeze([capital.binding, condition.binding]),
    page_marker_disposition: pageMarker,
    section_bindings: sectionBindings,
    representation_chapeau_binding: representationChapeauBinding,
    representation_limb_bindings: representationLimbBindings,
    company_equity_rights_continuity: companyEquityRightsContinuity,
    ordinary_inline_number_bindings: ordinaryInlineNumberBindings,
    party_token_bindings: partyTokenBindings,
    condition_clause_bindings: conditionClauseBindings,
    status: freeze({
      source_projection: 'MONOTONE_EXACT',
      parser_layout_noise: 'EXCLUDED_WITH_SOURCE_MAPPING_RETAINED',
      publication_authority: 'NONE',
      release_authority: 'NONE',
    }),
  };
  const closure = freeze({
    ...body,
    qxo_capitalisation_parser_source_closure_f27_id:
      contentId('QXO_CAPITALISATION_PARSER_SOURCE_CLOSURE_F27/V1', body),
    canonical_payload_digest:
      contentId('QXO_CAPITALISATION_PARSER_SOURCE_CLOSURE_F27_PAYLOAD/V1', body),
  });
  if (Buffer.byteLength(canonicalJson(closure), 'utf8') > MAX_CLOSURE_BYTES) {
    fail('CLOSURE_SIZE_EXCEEDED', 'QXO parser/source closure exceeds its size bound');
  }
  return closure;
}

function validateQxoCapitalisationParserSourceClosureF27({
  closure,
  ...inputs
} = {}) {
  if (!closure || typeof closure !== 'object') {
    fail('CLOSURE_REQUIRED', 'closure is required');
  }
  const expected = buildQxoCapitalisationParserSourceClosureF27(inputs);
  if (canonicalJson(closure) !== canonicalJson(expected)) {
    fail('CLOSURE_MISMATCH', 'QXO parser/source closure does not match its source texts');
  }
  return true;
}

module.exports = {
  MAX_CLOSURE_BYTES,
  QxoCapitalisationParserSourceClosureF27Error,
  buildQxoCapitalisationParserSourceClosureF27,
  validateQxoCapitalisationParserSourceClosureF27,
};
