const assert = require('assert');
const crypto = require('crypto');
const test = require('node:test');

const evidence = require('../lib/canonical-v2/metsera-gold-evidence');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const sealed = evidence.loadSealedMetseraGoldEvidence();

test('Metsera gold evidence has the exact sealed source universe and allowlist', () => {
  assert.deepStrictEqual(sealed.sourceUniverse.documents.map((document) => document.accession), evidence.REQUIRED_ACCESSIONS);
  assert.doesNotThrow(() => evidence.validateAllowlist(sealed.phaseAllowlist, evidence.validateEvidence(sealed.sourceUniverse, sealed.exclusivityGold).documents));
});

test('Metsera gold evidence rejects omitted or extra filings and cutoff breaches', () => {
  const omitted = clone(sealed.sourceUniverse);
  omitted.documents.pop();
  assert.throws(() => evidence.validateEvidence(omitted, sealed.exclusivityGold), /omits or adds/);
  const extra = clone(sealed.sourceUniverse);
  extra.documents.push(clone(extra.documents[0]));
  assert.throws(() => evidence.validateEvidence(extra, sealed.exclusivityGold), /omits or adds/);
  const late = clone(sealed.sourceUniverse);
  late.documents[0].filedOn = '2025-11-14';
  assert.throws(() => evidence.validateEvidence(late, sealed.exclusivityGold), /cutoff breach/);
});

test('Metsera gold evidence rejects source hash and byte-length drift', () => {
  const document = sealed.sourceUniverse.documents[0];
  assert.throws(() => evidence.verifySourceBytes(document.accession, Buffer.alloc(document.byteLength - 1)), /byte-length drift/);
  assert.throws(() => evidence.verifySourceBytes(document.accession, Buffer.alloc(document.byteLength)), /hash drift/);
});

test('Metsera gold evidence rejects interval and verbatim drift', () => {
  const passage = sealed.exclusivityGold.passages[0];
  const bytes = Buffer.concat([Buffer.alloc(passage.interval.byteStart), Buffer.from(passage.verbatimUtf8, 'utf8')]);
  assert.doesNotThrow(() => evidence.validatePassageAgainstBytes(passage, bytes));
  const changed = clone(passage);
  changed.verbatimUtf8 = `${changed.verbatimUtf8} `;
  assert.throws(() => evidence.validateEvidence(sealed.sourceUniverse, { ...clone(sealed.exclusivityGold), passages: [changed, ...sealed.exclusivityGold.passages.slice(1)] }), /verbatim byte drift|verbatim hash drift|evidence identity drift/);
  const alteredBytes = Buffer.from(passage.verbatimUtf8, 'utf8');
  alteredBytes[0] ^= 1;
  assert.throws(() => evidence.validatePassageAgainstBytes(passage, Buffer.concat([Buffer.alloc(passage.interval.byteStart), alteredBytes])), /interval text drift/);
});

test('Metsera gold evidence rejects party, role, and track crossings', () => {
  const crossed = clone(sealed.exclusivityGold);
  crossed.passages.find((passage) => passage.id === 'party-2-august-17-executed-exclusivity').partyIds.push('pfizer');
  assert.throws(() => evidence.validateEvidence(sealed.sourceUniverse, crossed), /party\/role\/track crossing/);
});

test('Metsera gold evidence rejects false-match admission and missing context or related discussion', () => {
  const admitted = clone(sealed.exclusivityGold);
  admitted.falseMatchTraps[0].classification = 'transaction-exclusivity';
  assert.throws(() => evidence.validateEvidence(sealed.sourceUniverse, admitted), /false-match admission/);
  const noContext = clone(sealed.exclusivityGold);
  delete noContext.passages[0].contextUnit;
  assert.throws(() => evidence.validateEvidence(sealed.sourceUniverse, noContext), /missing one-paragraph context/);
  const noRelated = clone(sealed.exclusivityGold);
  noRelated.passages.find((passage) => passage.id === 'party-2-august-11-proposed-exclusivity').relatedDiscussionIds = [];
  assert.throws(() => evidence.validateEvidence(sealed.sourceUniverse, noRelated), /missing related discussion/);
});

test('Metsera gold evidence has no answer leakage and rejects authority injection', () => {
  assert.deepStrictEqual(Object.keys(evidence).sort(), ['AUTHORITY', 'CUTOFF', 'REQUIRED_ACCESSIONS', 'loadSealedMetseraGoldEvidence', 'makeEvidenceIdentity', 'validateAllowlist', 'validateEvidence', 'validatePassageAgainstBytes', 'verifySourceBytes'].sort());
  assert.strictEqual(JSON.stringify(sealed.exclusivityGold).includes('expectedAnswer'), false);
  const injected = clone(sealed.sourceUniverse);
  injected.sourceAuthority = 'extractor-output';
  assert.throws(() => evidence.validateEvidence(injected, sealed.exclusivityGold), /unapproved source authority/);
  const allowlist = clone(sealed.phaseAllowlist);
  allowlist.allowedReadAuthority = 'writer';
  assert.throws(() => evidence.validateAllowlist(allowlist, evidence.validateEvidence(sealed.sourceUniverse, sealed.exclusivityGold).documents), /allowlist authority injection/);
});

test('Metsera gold evidence identities are deterministic over identical bytes', () => {
  const input = { accession: '0001193125-25-242494', byteStart: 12, byteEnd: 18, verbatimUtf8: 'abcdef' };
  const first = evidence.makeEvidenceIdentity(input);
  const second = evidence.makeEvidenceIdentity({ ...input });
  assert.strictEqual(first, second);
  assert.strictEqual(first, `sha256:${crypto.createHash('sha256').update('0001193125-25-242494:12:18:abcdef').digest('hex')}`);
});
