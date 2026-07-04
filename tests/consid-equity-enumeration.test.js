// FB3 item 3 — CONSID-EQUITY per-instrument treatment is mandatory. Live
// Metsera bug: Stock Options got a full treatment+vesting pair extracted
// from Section 2.03(a)(i), but Restricted Stock Awards (named in
// 2.03(a)(ii), a few sentences later) and the ESPP (treated entirely in the
// separate 2.03(e)) landed in outstandingInstruments with NO matching
// instrumentTreatments/instrumentVesting entry — the AI stopped reading
// after the first instrument. This is a prompt-strengthening fix (no
// deterministic backstop can invent real treatment language), so the test
// asserts the built prompt actually carries the strengthened instruction.
const test = require('node:test');
const assert = require('node:assert/strict');

const { buildFeatureInstructions } = require('../lib/parser-v2/extract.js');

test('the CONSID prompt requires per-instrument treatment coverage as mandatory', () => {
  const instr = buildFeatureInstructions('CONSID');
  assert.match(instr, /PER-INSTRUMENT TREATMENT IS MANDATORY/);
  assert.match(instr, /is a FAILURE/);
});

test('the CONSID prompt anchors on the Metsera failure mode (RSA + ESPP dropped after Stock Options)', () => {
  const instr = buildFeatureInstructions('CONSID');
  assert.match(instr, /Restricted Stock Awards/);
  assert.match(instr, /Employee Stock Purchase Plan/);
  assert.match(instr, /KNOWN, REPEATED FAILURE MODE/);
});

test('the CONSID prompt instructs scanning sub-clause by sub-clause without stopping at the first instrument', () => {
  const instr = buildFeatureInstructions('CONSID');
  assert.match(instr, /sub-clause by\s+sub-clause/);
  assert.match(instr, /do not stop reading once you have one\s+instrument fully captured/);
});
