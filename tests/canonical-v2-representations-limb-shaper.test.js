'use strict';

/**
 * Step 2X-L: REPRESENTATIONS shaper mints limb-assertion proposals from
 * instance.limbs (additive), with path-hygiene attribute limb_path_kind.
 * Qualifier and open-world proposal objects must stay byte-identical to the
 * pre-limb shape for the same parsed input.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  LIMB_ASSERTION_CLAIM_KEY,
  REPRESENTATION_QUALIFIER_CLAIM_KEY,
  OPEN_WORLD_CLAIM_KEY,
  shapeRepresentationQualifierProposals,
  classifyLimbPathKind,
  isOutlineMarkerLabel,
} = require('../lib/canonical-v2/native-producer/anthropic-provider');

const MARKER_ASSERTION = 'the Company is a corporation duly organized';
const DESCRIPTIVE_ASSERTION = 'the Company has the corporate power and authority';
const QUALIFIER_QUOTE = 'true and correct in all material respects';
const OPEN_WORLD_QUOTE = 'except as set forth in the Company SEC Documents';

const SOURCE_TEXT = [
  'Section 3.01 Organization.',
  MARKER_ASSERTION,
  'under the laws of Delaware and is',
  QUALIFIER_QUOTE,
  '.',
  'Section 3.02 Corporate Power.',
  DESCRIPTIVE_ASSERTION,
  'to enter into this Agreement.',
  OPEN_WORLD_QUOTE,
  '.',
].join(' ');

function baseParsed(overrides = {}) {
  return {
    representation_instances: [{
      section_reference: '3.01',
      party_making: 'the Company',
      chapeau_quote: 'Section 3.01 Organization.',
      limbs: [],
      qualifiers: [{
        kind: 'ACCURACY',
        code: 'MAT_ALL_MATERIAL',
        quote: QUALIFIER_QUOTE,
        attachment: {
          position: 'TRAILING',
          governs_path: null,
          ambiguity_signals: { items_grammatically_parallel: false },
        },
      }],
      definition_uses: [],
      cross_references: [],
      ...overrides.instance,
    }],
    bring_down_conditions: [],
    open_world_candidates: [{
      candidate_kind: 'ATTRIBUTE_OR_QUESTION',
      observed_category: 'SEC_DOCUMENTS_CARVEOUT',
      observed_quote: OPEN_WORLD_QUOTE,
      why_unmapped: 'disclosure-letter style carve-out',
      nearest_concept: null,
      ...overrides.openWorld,
    }],
  };
}

function qualifierAndOpenWorld(shaped) {
  return {
    proposals: shaped.proposals.filter((p) => (
      p.claim_definition_key === REPRESENTATION_QUALIFIER_CLAIM_KEY
      || p.claim_definition_key === OPEN_WORLD_CLAIM_KEY
    )),
    evidence_residuals: shaped.evidence_residuals.filter((r) => (
      r.reason !== 'LIMB_ASSERTION_QUOTE_UNVERIFIED'
    )),
  };
}

test('isOutlineMarkerLabel recognises paren markers and rejects descriptive headings', () => {
  assert.equal(isOutlineMarkerLabel('(a)'), true);
  assert.equal(isOutlineMarkerLabel('(i)'), true);
  assert.equal(isOutlineMarkerLabel('(A)'), true);
  assert.equal(isOutlineMarkerLabel('(ii)'), true);
  assert.equal(isOutlineMarkerLabel('(1)'), true);
  assert.equal(isOutlineMarkerLabel('Corporate power and authority'), false);
  assert.equal(isOutlineMarkerLabel('a'), false);
  assert.equal(isOutlineMarkerLabel('(not a marker!)'), false);
});

test('classifyLimbPathKind returns MARKER, DESCRIPTIVE, MIXED, or null', () => {
  assert.equal(classifyLimbPathKind(['(a)', '(i)']), 'MARKER');
  assert.equal(classifyLimbPathKind(['(A)']), 'MARKER');
  assert.equal(classifyLimbPathKind(['Corporate power and authority']), 'DESCRIPTIVE');
  assert.equal(classifyLimbPathKind(['(a)', 'Corporate power and authority']), 'MIXED');
  assert.equal(classifyLimbPathKind(null), null);
  assert.equal(classifyLimbPathKind([]), null);
});

test('REPRESENTATIONS shaper mints MARKER limb with evidence and limb_path_kind', () => {
  const parsed = baseParsed({
    instance: {
      limbs: [{
        limb_path: ['(a)', '(i)'],
        assertion_quote: MARKER_ASSERTION,
        subject: 'due organization',
      }],
    },
  });
  const shaped = shapeRepresentationQualifierProposals(parsed, SOURCE_TEXT);
  const limbs = shaped.proposals.filter((p) => p.claim_definition_key === LIMB_ASSERTION_CLAIM_KEY);
  assert.equal(limbs.length, 1);
  const limb = limbs[0];
  assert.equal(limb.proposal_kind, 'GOVERNED');
  assert.equal(limb.raw_value, MARKER_ASSERTION);
  assert.equal(limb.attributes.limb_path_kind, 'MARKER');
  assert.deepEqual(limb.attributes.limb_path, ['(a)', '(i)']);
  assert.equal(limb.attributes.subject, 'due organization');
  assert.ok(Array.isArray(limb.allowed_attributes));
  assert.ok(limb.allowed_attributes.includes('limb_path_kind'));
  assert.equal(limb.evidence.length, 1);
  assert.equal(typeof limb.evidence[0].absolute_start, 'number');
  assert.equal(typeof limb.evidence[0].absolute_end, 'number');
  assert.ok(limb.evidence[0].absolute_end > limb.evidence[0].absolute_start);
});

test('REPRESENTATIONS shaper mints DESCRIPTIVE limb with limb_path_kind DESCRIPTIVE', () => {
  const parsed = baseParsed({
    instance: {
      section_reference: '3.02',
      chapeau_quote: 'Section 3.02 Corporate Power.',
      limbs: [{
        limb_path: ['Corporate power and authority'],
        assertion_quote: DESCRIPTIVE_ASSERTION,
        subject: 'corporate power',
      }],
    },
  });
  const shaped = shapeRepresentationQualifierProposals(parsed, SOURCE_TEXT);
  const limbs = shaped.proposals.filter((p) => p.claim_definition_key === LIMB_ASSERTION_CLAIM_KEY);
  assert.equal(limbs.length, 1);
  assert.equal(limbs[0].attributes.limb_path_kind, 'DESCRIPTIVE');
  assert.deepEqual(limbs[0].attributes.limb_path, ['Corporate power and authority']);
  assert.equal(limbs[0].evidence.length, 1);
});

test('unverifiable assertion_quote becomes LIMB_ASSERTION_QUOTE_UNVERIFIED residual, not a proposal', () => {
  const parsed = baseParsed({
    instance: {
      limbs: [{
        limb_path: ['(a)'],
        assertion_quote: 'this quote is nowhere in the source text at all',
        subject: 'hallucinated',
      }],
    },
  });
  const shaped = shapeRepresentationQualifierProposals(parsed, SOURCE_TEXT);
  const limbs = shaped.proposals.filter((p) => p.claim_definition_key === LIMB_ASSERTION_CLAIM_KEY);
  assert.equal(limbs.length, 0);
  assert.ok(shaped.evidence_residuals.some((r) => (
    r.reason === 'LIMB_ASSERTION_QUOTE_UNVERIFIED'
    && r.quote_preview.startsWith('this quote is nowhere')
  )));
});

test('qualifier and open-world proposals stay byte-identical when limbs are added', () => {
  const withoutLimbs = baseParsed();
  const withLimbs = baseParsed({
    instance: {
      limbs: [{
        limb_path: ['(a)', '(i)'],
        assertion_quote: MARKER_ASSERTION,
        subject: 'due organization',
      }],
    },
  });

  const baseline = qualifierAndOpenWorld(
    shapeRepresentationQualifierProposals(withoutLimbs, SOURCE_TEXT),
  );
  const withLimbOutput = shapeRepresentationQualifierProposals(withLimbs, SOURCE_TEXT);
  const filtered = qualifierAndOpenWorld(withLimbOutput);

  assert.equal(
    withLimbOutput.proposals.filter((p) => p.claim_definition_key === LIMB_ASSERTION_CLAIM_KEY).length,
    1,
  );
  assert.deepEqual(filtered.proposals, baseline.proposals);
  assert.deepEqual(filtered.evidence_residuals, baseline.evidence_residuals);

  // Explicit expectations for the baseline streams themselves.
  assert.equal(baseline.proposals.length, 2);
  assert.equal(baseline.proposals[0].claim_definition_key, REPRESENTATION_QUALIFIER_CLAIM_KEY);
  assert.equal(baseline.proposals[0].raw_value, QUALIFIER_QUOTE);
  assert.equal(baseline.proposals[1].claim_definition_key, OPEN_WORLD_CLAIM_KEY);
  assert.equal(baseline.proposals[1].raw_value, OPEN_WORLD_QUOTE);
});
