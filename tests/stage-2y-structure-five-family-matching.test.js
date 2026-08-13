'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  SELECTION_MODES,
  selectFamilySections,
} = require('../lib/canonical-v2/m7-deterministic-generalisation');

const ROOT = path.resolve(__dirname, '..');
const BASE = 'evidence/canonical-v2/stage-2y-structure-migration';
const SEALED_M2 = `${BASE}/shadow/m2`;
const M7_M2 = `${BASE}/shadow/m7-generalisation-row-correction`;

const EXPECTED_REFERENCES = Object.freeze({
  redhat: {
    TERMINATION: '7.01',
    INTERIM_OPERATING: '4.01(a)',
    DNO_INDEMNIFICATION: '5.05',
    ANTITRUST_REGULATORY: '5.03',
  },
  skechers: {
    TERMINATION: '8.1',
    INTERIM_OPERATING: 'ARTICLE V',
    DNO_INDEMNIFICATION: '6.10',
    ANTITRUST_REGULATORY: '6.2',
    TAX_MATTERS: '2.14',
  },
  concho: {
    TERMINATION: '8.1',
    INTERIM_OPERATING: '6.1(a)',
    DNO_INDEMNIFICATION: '6.10',
    ANTITRUST_REGULATORY: '6.8',
    TAX_MATTERS: '6.18',
  },
  topbuild: {
    TERMINATION: '6.1',
    INTERIM_OPERATING: '4.1',
    DNO_INDEMNIFICATION: '4.13',
    ANTITRUST_REGULATORY: '4.6',
    TAX_MATTERS: '4.23',
  },
  skywater: {
    TERMINATION: '9.1',
    INTERIM_OPERATING: '5.1',
    DNO_INDEMNIFICATION: '6.3',
    ANTITRUST_REGULATORY: '7.1',
    TAX_MATTERS: '7.4',
  },
  metsera: {
    TERMINATION: '8.01',
    INTERIM_OPERATING: '5.01',
    DNO_INDEMNIFICATION: '6.05',
    ANTITRUST_REGULATORY: '6.03',
  },
  modiv: {
    TERMINATION: '7.1',
    INTERIM_OPERATING: '5.1',
    DNO_INDEMNIFICATION: '5.8',
    ANTITRUST_REGULATORY: '5.5',
    TAX_MATTERS: '1.7',
  },
  'abbvie-landos': {
    TERMINATION: '7.1',
    INTERIM_OPERATING: '5.2(a)',
    DNO_INDEMNIFICATION: '5.7',
    ANTITRUST_REGULATORY: '5.5',
    TAX_MATTERS: '8.11',
  },
  'lilly-verve': {
    TERMINATION: '8.1',
    INTERIM_OPERATING: '6.1(a)',
    DNO_INDEMNIFICATION: '6.5',
    ANTITRUST_REGULATORY: '6.6',
    TAX_MATTERS: '3.7',
  },
  'rocket-redfin': {
    TERMINATION: '6.1',
    INTERIM_OPERATING: '4.1',
    DNO_INDEMNIFICATION: '4.10',
    ANTITRUST_REGULATORY: '4.7',
    TAX_MATTERS: '1.10',
  },
});

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function indexes() {
  const sealed = fs.readdirSync(path.join(ROOT, SEALED_M2))
    .filter((name) => name.endsWith('.agreement-index.json'))
    .map((name) => readJson(`${SEALED_M2}/${name}`));
  const additional = ['abbvie-landos', 'lilly-verve', 'rocket-redfin']
    .map((deal) => readJson(`${M7_M2}/${deal}/m2/agreement-index.json`));
  return [...sealed, ...additional];
}

const familyOrder = readJson(`${BASE}/control/m5-calibration-policy.json`)
  .family_order_contract.families;

test('five recovered family matchers bind the intended operative clauses', () => {
  for (const index of indexes()) {
    const deal = index.source_binding.deal;
    const selected = new Map(selectFamilySections(index, familyOrder)
      .map((entry) => [entry.family_key, entry]));
    for (const [familyKey, expectedReference] of Object.entries(EXPECTED_REFERENCES[deal])) {
      const binding = selected.get(familyKey);
      assert.equal(binding.state, 'RECORDED_INPUT_BINDING', `${deal} ${familyKey}`);
      assert.equal(binding.selection_mode, SELECTION_MODES.AUTHORED_UNIT_MATCH, `${deal} ${familyKey}`);
      assert.equal(binding.source_reference, expectedReference, `${deal} ${familyKey}`);
      assert.ok(binding.authored_units.length > 0, `${deal} ${familyKey}`);
    }
  }
});

test('termination binds the grant of termination rights, not a later condition or effect clause', () => {
  for (const index of indexes()) {
    const binding = selectFamilySections(index, familyOrder)
      .find((entry) => entry.family_key === 'TERMINATION');
    const bytes = Buffer.from(index.source_binding.canonical_text, 'utf8');
    const text = bytes.subarray(binding.source_span.start_byte, binding.source_span.end_byte).toString('utf8');
    assert.match(text, /\bThis Agreement may be (?:validly )?terminated\b/i, index.source_binding.deal);
    assert.doesNotMatch(binding.source_reference, /effect|fee/i, index.source_binding.deal);
  }
});

test('tax representation headings do not become normal tax covenant rows', () => {
  for (const deal of ['redhat', 'metsera']) {
    const index = indexes().find((entry) => entry.source_binding.deal === deal);
    const binding = selectFamilySections(index, familyOrder)
      .find((entry) => entry.family_key === 'TAX_MATTERS');
    if (deal === 'redhat') {
      assert.equal(binding.state, 'INPUT_NOT_AVAILABLE');
      continue;
    }
    assert.equal(binding.selection_mode, SELECTION_MODES.DOCUMENT_ORDER_FALLBACK);
    assert.notEqual(binding.selection_mode, SELECTION_MODES.AUTHORED_UNIT_MATCH);
  }
});

test('misclassified short heading sentences are never emitted as legal units', () => {
  const headingText = /^(?:section\s+)?[\d.]+\s+(?:indemnification|directors?['’]? and officers?['’]?)/i;
  for (const index of indexes()) {
    const binding = selectFamilySections(index, familyOrder)
      .find((entry) => entry.family_key === 'DNO_INDEMNIFICATION');
    const bytes = Buffer.from(index.source_binding.canonical_text, 'utf8');
    for (const unit of binding.authored_units) {
      const text = bytes.subarray(unit.source_span.start_byte, unit.source_span.end_byte).toString('utf8').trim();
      assert.doesNotMatch(text, headingText, index.source_binding.deal);
    }
  }
});
