const PROVISION_CARD_TYPES = [
  'CONSIDERATION',
  'REPRESENTATION',
  'MATERIAL_CONTRACT',
  'CLOSING_CONDITION',
  'COVENANT_INTERIM_OPERATING',
  'COVENANT_NO_SOLICITATION',
  'COVENANT_OTHER',
  'TERMINATION_RIGHT',
  'TERMINATION_FEE',
  'DEFINITION',
  'ANTITRUST_REGULATORY',
  'SEC_FILING_MEETING',
  'EMPLOYEE_BENEFITS',
  'STRUCTURE_MECHANICS',
  'MAE',
  'NO_OTHER_REPS',
  'MISC_BOILERPLATE',
];

const PARTY_SCOPES = ['COMPANY', 'PARENT', 'BUYER', 'MERGER_SUB', 'MUTUAL', 'N_A'];
const PARTY_SCOPE_OPTIONAL_TYPES = new Set(['MISC_BOILERPLATE', 'MAE', 'STRUCTURE_MECHANICS']);
const DEFAULT_GROUPS_BY_TYPE = {
  CONSIDERATION: ['primary', 'mechanics', 'qualifiers', 'cross_refs', 'metadata'],
  REPRESENTATION: ['primary', 'qualifiers', 'cross_refs', 'metadata'],
  MATERIAL_CONTRACT: ['primary', 'mechanics', 'qualifiers', 'cross_refs', 'metadata'],
  CLOSING_CONDITION: ['primary', 'mechanics', 'cross_refs', 'metadata'],
  COVENANT_INTERIM_OPERATING: ['primary', 'mechanics', 'qualifiers', 'cross_refs', 'metadata'],
  COVENANT_NO_SOLICITATION: ['primary', 'mechanics', 'qualifiers', 'cross_refs', 'metadata'],
  TERMINATION_RIGHT: ['primary', 'mechanics', 'qualifiers', 'cross_refs', 'metadata'],
  TERMINATION_FEE: ['primary', 'mechanics', 'cross_refs', 'metadata'],
  DEFINITION: ['primary', 'mechanics', 'cross_refs', 'metadata'],
};

const QUOTE_KEYS = [
  'primary_quote',
  'verbatim_quote',
  'standard_verbatim_quote',
  'tier_standard_quote',
  'threshold_verbatim_quote',
  'fee_amount_verbatim_quote',
  'materiality_qualifier_quote',
  'knowledge_qualifier_quote',
  'ordinary_course_carveout_quote',
  'superior_proposal_definition_quote',
  'intervening_event_definition_quote',
  'extension_conditions_quote',
];

function fail(message) {
  throw new Error(`WP-SCHEMA-03 card invariant failed: ${message}`);
}

function spanValue(row, keys) {
  for (const key of keys) {
    if (row && row[key] !== undefined && row[key] !== null) return row[key];
  }
  return null;
}

function assertValidSpan(sourceText, start, end, label) {
  if (!Number.isInteger(start) || !Number.isInteger(end)) {
    fail(`${label} span must be integer start/end`);
  }
  if (start < 0 || end <= start || end > String(sourceText || '').length) {
    fail(`${label} span ${start}:${end} is outside region text`);
  }
}

function assertQuoteSlice(sourceText, start, end, quote, label) {
  assertValidSpan(sourceText, start, end, label);
  const expected = String(sourceText).slice(start, end);
  if (expected !== quote) {
    fail(`${label} quote fidelity mismatch`);
  }
}

function assertMaybeQuoteSlice(sourceText, row, quoteKey, label) {
  const quote = row && row[quoteKey];
  const start = spanValue(row, [`${quoteKey}_start`, 'source_span_start']);
  const end = spanValue(row, [`${quoteKey}_end`, 'source_span_end']);
  if (quote === null || quote === undefined || quote === '') {
    if (start !== null || end !== null) fail(`${label} has span without quote`);
    return;
  }
  assertQuoteSlice(sourceText, start, end, String(quote), label);
}

function assertPrimaryQuote(card) {
  assertQuoteSlice(
    card.regionFullText || card.region_full_text,
    card.primaryQuoteStart ?? card.primary_quote_start,
    card.primaryQuoteEnd ?? card.primary_quote_end,
    card.primaryQuote ?? card.primary_quote,
    'primary_quote',
  );
}

function assertFieldGroups(groups, provisionType) {
  if (!Array.isArray(groups) || groups.length === 0) fail('fieldGroups must be non-empty');
  const primary = groups.filter((g) => (g && g.name === 'primary') || (g && g.group_name === 'primary'));
  if (primary.length !== 1) fail('fieldGroups must contain exactly one primary group');
  const sorted = groups
    .map((g) => Number(g.displayOrder ?? g.display_order))
    .sort((a, b) => a - b);
  for (let i = 0; i < sorted.length; i += 1) {
    if (sorted[i] !== i + 1) fail('fieldGroups display_order must be 1..N with no gaps');
  }
  const expected = DEFAULT_GROUPS_BY_TYPE[provisionType];
  if (expected) {
    const names = groups
      .slice()
      .sort((a, b) => Number(a.displayOrder ?? a.display_order) - Number(b.displayOrder ?? b.display_order))
      .map((g) => g.name || g.group_name);
    let previousExpectedIndex = -1;
    for (let i = 0; i < names.length; i += 1) {
      const expectedIndex = expected.indexOf(names[i]);
      if (expectedIndex < 0) fail(`${provisionType} group "${names[i]}" is not declared`);
      if (expectedIndex <= previousExpectedIndex) {
        fail(`${provisionType} group "${names[i]}" is out of order`);
      }
      previousExpectedIndex = expectedIndex;
    }
  }
}

function looksSerializedObjectText(value) {
  if (typeof value !== 'string') return false;
  const s = value.trim();
  if (!s) return false;
  if (s.includes('[object Object]')) return true;
  if (!/^[{\[]/.test(s)) return false;
  try {
    const parsed = JSON.parse(s);
    return parsed !== null && typeof parsed === 'object';
  } catch {
    return false;
  }
}

function assertNoSerializedObjectText(value, path = 'payload') {
  if (looksSerializedObjectText(value)) fail(`${path} contains serialized object text`);
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSerializedObjectText(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      assertNoSerializedObjectText(child, `${path}.${key}`);
    }
  }
}

function rowsFromChildTables(childTables) {
  const out = [];
  if (!childTables || typeof childTables !== 'object') return out;
  for (const [table, rows] of Object.entries(childTables)) {
    if (!Array.isArray(rows)) continue;
    rows.forEach((row, index) => out.push({ table, row, index }));
  }
  return out;
}

function assertRowQuoteFields(sourceText, row, label) {
  for (const quoteKey of QUOTE_KEYS) {
    if (!row || !Object.prototype.hasOwnProperty.call(row, quoteKey)) continue;
    assertMaybeQuoteSlice(sourceText, row, quoteKey, `${label}.${quoteKey}`);
  }
}

function assertCrossReferences(sourceText, crossReferences) {
  if (!Array.isArray(crossReferences)) return;
  crossReferences.forEach((ref, index) => {
    assertValidSpan(
      sourceText,
      ref.sourceSpanStart ?? ref.source_span_start,
      ref.sourceSpanEnd ?? ref.source_span_end,
      `crossReferences[${index}]`,
    );
  });
}

function enforceCardModelInvariants(card, options = {}) {
  if (!card || typeof card !== 'object') fail('card payload missing');
  const provisionType = card.provisionType || card.provision_type;
  if (!PROVISION_CARD_TYPES.includes(provisionType)) fail(`unknown provision_type ${provisionType}`);

  const regionFullText = card.regionFullText || card.region_full_text || '';
  if (options.parserRegionText !== undefined && regionFullText !== options.parserRegionText) {
    fail('region_full_text does not match parser region rawText');
  }
  assertPrimaryQuote(card);

  const partyScope = card.partyScope ?? card.party_scope;
  if (!PARTY_SCOPE_OPTIONAL_TYPES.has(provisionType) && !partyScope) {
    fail(`${provisionType} requires party_scope`);
  }
  if (partyScope && !PARTY_SCOPES.includes(partyScope)) fail(`unknown party_scope ${partyScope}`);

  assertFieldGroups(card.fieldGroups || card.field_groups || [], provisionType);
  assertCrossReferences(regionFullText, card.crossReferences || card.cross_references);

  const bringDown = card.bringDown || card.bring_down;
  if (bringDown) assertRowQuoteFields(regionFullText, bringDown, 'bringDown');

  for (const { table, row, index } of rowsFromChildTables(card.childTables || card.child_tables)) {
    assertRowQuoteFields(regionFullText, row, `${table}[${index}]`);
  }

  assertNoSerializedObjectText(card);
  return true;
}

module.exports = {
  PROVISION_CARD_TYPES,
  PARTY_SCOPES,
  PARTY_SCOPE_OPTIONAL_TYPES,
  DEFAULT_GROUPS_BY_TYPE,
  QUOTE_KEYS,
  assertQuoteSlice,
  assertFieldGroups,
  looksSerializedObjectText,
  assertNoSerializedObjectText,
  enforceCardModelInvariants,
};
