const test = require('node:test');
const assert = require('node:assert/strict');

const { enforceConsiderationEquityInvariants } = require('../../../lib/parser-v2/consideration-equity');

function baseExtracted(overrides = {}) {
  const regionFullText = '(i) each Company Stock Option shall be canceled for cash. (ii) each Company Restricted Stock Award shall vest in full.';
  return {
    provisionType: 'CONSID-EQUITY',
    sectionRef: 'Section 2.03',
    regionId: '00000000-0000-0000-0000-000000000203',
    regionFullText,
    regionHash: 'hash',
    treatmentGrouping: 'SEPARATE_SUBPROVISIONS',
    extractedBy: 'CODEX',
    extractionVersion: 'test',
    treatments: [
      {
        instrumentType: 'STOCK_OPTIONS',
        spanType: 'OWN_SUBPROVISION',
        sourceSpanStart: 0,
        sourceSpanEnd: 55,
        verbatimQuote: regionFullText.slice(0, 55),
      },
      {
        instrumentType: 'RSA',
        spanType: 'OWN_SUBPROVISION',
        sourceSpanStart: 56,
        sourceSpanEnd: regionFullText.length,
        verbatimQuote: regionFullText.slice(56),
      },
    ],
    ...overrides,
  };
}

test('consideration equity invariant rejects zero treatments', () => {
  assert.throws(
    () => enforceConsiderationEquityInvariants(baseExtracted({ treatments: [] })),
    /zero treatments/i,
  );
});

test('consideration equity invariant rejects fabricated treatment quotes', () => {
  const extracted = baseExtracted();
  extracted.treatments[0].verbatimQuote = 'not in source';
  assert.throws(() => enforceConsiderationEquityInvariants(extracted), /quote fidelity/i);
});

test('consideration equity invariant rejects shared own-subprovision spans', () => {
  const extracted = baseExtracted();
  extracted.treatments[1].sourceSpanStart = extracted.treatments[0].sourceSpanStart;
  extracted.treatments[1].sourceSpanEnd = extracted.treatments[0].sourceSpanEnd;
  extracted.treatments[1].verbatimQuote = extracted.treatments[0].verbatimQuote;
  assert.throws(() => enforceConsiderationEquityInvariants(extracted), /shared own-subprovision span/i);
});

test('consideration equity invariant rejects grouping/span mismatch', () => {
  const extracted = baseExtracted();
  extracted.treatments[1].spanType = 'SHARED_SENTENCE';
  assert.throws(() => enforceConsiderationEquityInvariants(extracted), /grouping invariant/i);
});

test('consideration equity invariant rejects duplicate DB treatment keys', () => {
  const extracted = baseExtracted();
  extracted.treatments[1].instrumentType = extracted.treatments[0].instrumentType;
  extracted.treatments[1].sourceSpanStart = extracted.treatments[0].sourceSpanStart;
  extracted.treatments[1].verbatimQuote = extracted.regionFullText.slice(
    extracted.treatments[1].sourceSpanStart,
    extracted.treatments[1].sourceSpanEnd,
  );
  assert.throws(() => enforceConsiderationEquityInvariants(extracted), /duplicate treatment key/i);
});
