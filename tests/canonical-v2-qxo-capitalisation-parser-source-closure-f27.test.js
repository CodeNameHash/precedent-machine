const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const {
  MAX_CLOSURE_BYTES,
  buildQxoCapitalisationParserSourceClosureF27,
  validateQxoCapitalisationParserSourceClosureF27,
} = require('../lib/canonical-v2/qxo-capitalisation-parser-source-closure-f27');
const { canonicalJson } = require('../lib/canonical-v2/canonical-bytes');
const { QXO_5_2_TEXT } = require('./fixtures/qxo-section-5-2');

const capitalStructureText = fs.readFileSync(
  'tests/fixtures/qxo-section-3-1-b.txt',
  'utf8',
);

function buildClosure() {
  return buildQxoCapitalisationParserSourceClosureF27({
    capital_structure_text: capitalStructureText,
    closing_condition_text: QXO_5_2_TEXT,
  });
}

function bindingByLabel(closure, label) {
  const bindings = [
    ...closure.section_bindings,
    closure.representation_chapeau_binding,
    ...closure.representation_limb_bindings,
    closure.company_equity_rights_continuity,
    ...closure.ordinary_inline_number_bindings,
    ...closure.party_token_bindings,
    ...closure.condition_clause_bindings,
  ];
  return bindings.find((binding) => binding.label === label);
}

function assertExactProjection(binding, rawText) {
  let priorSourceByteEnd = -1;
  binding.source_segments.forEach((segment) => {
    assert.ok(segment.source_byte_start >= priorSourceByteEnd);
    assert.equal(
      Buffer.from(rawText, 'utf8')
        .subarray(segment.source_byte_start, segment.source_byte_end)
        .toString('utf8'),
      segment.exact_source_text,
    );
    priorSourceByteEnd = segment.source_byte_end;
  });
  assert.equal(
    binding.source_segments
      .map((segment) => segment.projected_clean_text)
      .join(''),
    binding.exact_clean_text,
  );
}

test('QXO F27 closes standalone page 16 through an exact monotone parser projection', () => {
  const closure = buildClosure();
  const capitalBinding = closure.source_bindings.find(
    (binding) => binding.source_key === 'SECTION_3_1_B',
  );
  const capitalSection = bindingByLabel(
    closure,
    'SECTION_3_1_B_CAPITAL_STRUCTURE',
  );

  assert.match(capitalStructureText, /(^|\n)16(?=\n|$)/);
  assert.doesNotMatch(capitalSection.exact_clean_text, /(^|\n)16(?=\n|$)/);
  assert.deepEqual(closure.page_marker_disposition, {
    schema_version: 'QXO_F27_PAGE_MARKER_DISPOSITION/V1',
    source_key: 'SECTION_3_1_B',
    exact_source_text: '16',
    source_character_start: 3437,
    source_character_end: 3439,
    source_byte_start: 3461,
    source_byte_end: 3463,
    parser_clean_occurrence_count: 0,
    disposition: 'EXCLUDED_AS_STANDALONE_PAGE_MARKER',
  });
  assert.equal(closure.source_transform, 'PARSER_V2_TEXT_LAYERS/V1');
  assert.equal(capitalBinding.monotone_projection_verified, true);
  assert.equal(capitalBinding.exact_round_trip_verified, true);
  assert.equal(
    capitalBinding.mapping_count,
    capitalBinding.clean_text_character_length + 1,
  );
  assert.match(capitalBinding.clean_to_source_map_sha256, /^[a-f0-9]{64}$/);
  assert.equal(
    Buffer.from(capitalStructureText, 'utf8')
      .subarray(
        closure.page_marker_disposition.source_byte_start,
        closure.page_marker_disposition.source_byte_end,
      )
      .toString('utf8'),
    '16',
  );
  closure.section_bindings.forEach((binding) => assertExactProjection(
    binding,
    binding.source_key === 'SECTION_3_1_B'
      ? capitalStructureText
      : QXO_5_2_TEXT,
  ));
  assert.equal(
    closure.status.parser_layout_noise,
    'EXCLUDED_WITH_SOURCE_MAPPING_RETAINED',
  );
});

test('QXO F27 preserves continuous Company Equity Rights text and ordinary inline numbers', () => {
  const closure = buildClosure();
  const continuity = closure.company_equity_rights_continuity;
  const limbs = closure.representation_limb_bindings;
  const chapeau = closure.representation_chapeau_binding;

  assert.equal(
    continuity.exact_clean_text,
    '(the items referred to in clauses (B) and (C) of or with respect to any Person, '
      + 'collectively,\n\n"Company Equity Rights"), and no such Company Equity Rights '
      + 'are authorized, issued or outstanding.',
  );
  assert.ok(continuity.source_segments.length >= 2);
  assert.equal(
    continuity.source_segments
      .map((segment) => segment.projected_clean_text)
      .join(''),
    continuity.exact_clean_text,
  );
  assertExactProjection(continuity, capitalStructureText);
  assert.equal(
    continuity.source_segments
      .map((segment) => segment.exact_source_text)
      .join('')
      .includes('\n16\n'),
    false,
  );
  assert.equal(limbs.length, 5);
  assert.equal(chapeau.exact_clean_text, '(b)Capital Structure.\n');
  assertExactProjection(chapeau, capitalStructureText);
  limbs.forEach((binding, index) => {
    assert.equal(binding.label, `SECTION_3_1_B_LIMB_${index + 1}`);
    assertExactProjection(binding, capitalStructureText);
    assert.doesNotMatch(binding.exact_clean_text, /(^|\n)16(?=\n|$)/);
  });
  assert.ok(limbs[2].source_segments.length >= 2);
  assert.equal(
    limbs[2].source_segments.some(
      (segment) => /(^|\n)16(?=\n|$)/.test(segment.exact_source_text),
    ),
    false,
  );

  assert.deepEqual(
    closure.ordinary_inline_number_bindings.map(
      (binding) => binding.exact_clean_text,
    ),
    [
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
    ],
  );
  closure.ordinary_inline_number_bindings.forEach((binding) => {
    assertExactProjection(binding, capitalStructureText);
    assert.equal(binding.source_segments.length, 1);
    assert.equal(
      binding.source_segments[0].exact_source_text,
      binding.exact_clean_text,
    );
  });
});

test('QXO F27 binds exact buyer-group party tokens and section 5.2 clause text', () => {
  const closure = buildClosure();

  assert.deepEqual(
    closure.party_token_bindings.map((binding) => binding.exact_clean_text),
    ['Parent', 'Titanium Merger Sub', 'Forward Merger Sub'],
  );
  closure.party_token_bindings.forEach((binding) => {
    assertExactProjection(binding, QXO_5_2_TEXT);
    assert.equal(binding.source_segments.length, 1);
    assert.equal(
      binding.source_segments[0].exact_source_text,
      binding.exact_clean_text,
    );
  });

  const clauseB = bindingByLabel(closure, 'SECTION_5_2_A_II_CLAUSE_B');
  const clauseC = bindingByLabel(closure, 'SECTION_5_2_A_II_CLAUSE_C');
  const proviso = bindingByLabel(
    closure,
    'SECTION_5_2_A_II_DATED_REPRESENTATION_PROVISO',
  );
  const definition = bindingByLabel(
    closure,
    'DE_MINIMIS_INACCURACIES_DEFINITION',
  );
  assert.match(
    clauseB.exact_clean_text,
    /Section 3\.1\(b\)\(i\).*Section 3\.1\(b\)\(iii\).*except for De Minimis Inaccuracies,/,
  );
  assert.match(
    clauseC.exact_clean_text,
    /Section 3\.1\(b\) \(Capital Structure\).*other than Section 3\.1\(b\)\(i\) and Section 3\.1\(b\)\(iii\).*in all material respects/,
  );
  assert.match(
    proviso.exact_clean_text,
    /with respect to clauses \(A\), \(B\), \(C\) and \(D\).*only as of such date or period\./,
  );
  assert.equal(
    definition.exact_clean_text,
    'For purposes of this Agreement, "De Minimis Inaccuracies" means any inaccuracies '
      + 'that individually or in the aggregate are de minimis relative to the total fully '
      + 'diluted equity capitalization of the Company or Parent, as the case may be;',
  );
  [clauseB, clauseC, proviso, definition].forEach((binding) => {
    assertExactProjection(binding, QXO_5_2_TEXT);
    assert.equal(
      binding.source_segments
        .map((segment) => segment.projected_clean_text)
        .join(''),
      binding.exact_clean_text,
    );
  });
});

test('QXO F27 closure is deterministic, bounded, immutable and source-bound', () => {
  const closure = buildClosure();
  const rebuilt = buildClosure();

  assert.equal(canonicalJson(closure), canonicalJson(rebuilt));
  assert.equal(
    validateQxoCapitalisationParserSourceClosureF27({
      closure,
      capital_structure_text: capitalStructureText,
      closing_condition_text: QXO_5_2_TEXT,
    }),
    true,
  );
  assert.equal(Object.isFrozen(closure), true);
  assert.equal(Object.isFrozen(closure.condition_clause_bindings[0]), true);
  assert.ok(Buffer.byteLength(canonicalJson(closure), 'utf8') <= MAX_CLOSURE_BYTES);
  assert.equal(closure.status.publication_authority, 'NONE');
  assert.equal(closure.status.release_authority, 'NONE');

  assert.throws(
    () => validateQxoCapitalisationParserSourceClosureF27({
      closure,
      capital_structure_text: capitalStructureText.replace('250,000,000', '250,000,001'),
      closing_condition_text: QXO_5_2_TEXT,
    }),
    (error) => error.code === 'EXACT_TEXT_NOT_UNIQUE'
      || error.code === 'CLOSURE_MISMATCH',
  );
});
