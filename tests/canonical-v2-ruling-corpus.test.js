'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const {
  RULING_CORPUS_SCHEMA,
  RULING_CORPUS_ENTRY_SCHEMA,
  EMPTY_RULING_CORPUS,
  QUALIFIER_KINDS,
  buildRulingCorpus,
  validateRulingCorpus,
  rulingKey,
  lookupRuling,
  applyRuling,
  appendRuling,
  RulingCorpusError,
} = require('../lib/canonical-v2/native-producer/ruling-corpus');
const {
  QUALIFIER_KINDS: LEXICON_QUALIFIER_KINDS,
  classifyQualifierQuote,
} = require('../lib/canonical-v2/native-producer/qualifier-kind-lexicon');

const REPO_ROOT = path.resolve(__dirname, '..');
const REAL_CORPUS_PATH = path.join(REPO_ROOT, 'contracts', 'ruling-corpus', 'ruling-corpus.v1.json');
const CONFIRM_SCRIPT_PATH = path.join(REPO_ROOT, 'scripts', 'confirm-kind-ruling.mjs');

function verifiedEntry(overrides = {}) {
  return {
    normalised_phrase: 'true and correct in all material respects',
    attachment_position: 'CHAPEAU',
    concept_family: 'REP-T-CAP',
    ruled_kind: 'ACCURACY',
    ruled_code: 'MAT_ALL_MATERIAL',
    ruler: 'ben@example.com',
    ruled_at: '2026-08-01T12:00:00.000Z',
    provenance_tag: 'VERIFIED',
    lexicon_version_at_ruling: 1,
    ...overrides,
  };
}

function abstainingClassifier() {
  return () => ({ kind: null });
}

function agreeingClassifier(kind) {
  return () => ({ kind });
}

// ─── Corpus shape / content-addressing ───

test('EMPTY_RULING_CORPUS is a valid, empty, content-addressed V1 corpus', () => {
  assert.equal(EMPTY_RULING_CORPUS.schema_version, RULING_CORPUS_SCHEMA);
  assert.equal(EMPTY_RULING_CORPUS.version, 1);
  assert.deepEqual(EMPTY_RULING_CORPUS.rulings, []);
  assert.equal(typeof EMPTY_RULING_CORPUS.ruling_corpus_id, 'string');
  assert.equal(EMPTY_RULING_CORPUS.ruling_corpus_id.length, 64); // sha256 hex
  assert.doesNotThrow(() => validateRulingCorpus(EMPTY_RULING_CORPUS));
});

test('a corpus with a ruling rejects a duplicate exact key', () => {
  const entry = verifiedEntry();
  assert.throws(
    () => buildRulingCorpus({ version: 1, rulings: [entry, verifiedEntry()] }),
    (err) => err instanceof RulingCorpusError && err.code === 'DUPLICATE_RULING_KEY',
  );
});

// ─── Receipt-pinnable corpus version: content-addressed file round-trips ───

test('the content-addressed corpus file round-trips: rebuilding from its own JSON reproduces the pinned id', () => {
  assert.ok(fs.existsSync(REAL_CORPUS_PATH), 'contracts/ruling-corpus/ruling-corpus.v1.json must exist');
  const onDisk = JSON.parse(fs.readFileSync(REAL_CORPUS_PATH, 'utf8'));
  assert.equal(onDisk.schema_version, RULING_CORPUS_SCHEMA);
  const rebuilt = buildRulingCorpus({ version: onDisk.version, rulings: onDisk.rulings });
  assert.equal(rebuilt.ruling_corpus_id, onDisk.ruling_corpus_id,
    'the id stored in the file must equal the id recomputed from its own version+rulings');
  // Initial corpus is the empty one, matching EMPTY_RULING_CORPUS exactly.
  assert.equal(onDisk.ruling_corpus_id, EMPTY_RULING_CORPUS.ruling_corpus_id);
});

test('the corpus id is receipt-pinnable: same rulings, same order -> identical id across independent builds', () => {
  const a = buildRulingCorpus({ version: 7, rulings: [verifiedEntry()] });
  const b = buildRulingCorpus({ version: 7, rulings: [verifiedEntry()] });
  assert.equal(a.ruling_corpus_id, b.ruling_corpus_id);
  // Any change to the ruling set changes the id -- a receipt pin can never
  // silently point at a different ruling set later.
  const c = buildRulingCorpus({ version: 7, rulings: [verifiedEntry({ ruled_code: 'MAT_ALL_RESPECTS' })] });
  assert.notEqual(a.ruling_corpus_id, c.ruling_corpus_id);
});

test('a resolution receipt can pin {ruling_corpus_version, ruling_corpus_id} straight off the built corpus', () => {
  const corpus = buildRulingCorpus({ version: 3, rulings: [verifiedEntry()] });
  const pin = { ruling_corpus_version: corpus.version, ruling_corpus_id: corpus.ruling_corpus_id };
  assert.equal(pin.ruling_corpus_version, 3);
  assert.equal(pin.ruling_corpus_id.length, 64);
});

// ─── Exact-key lookup ───

test('exact key (phrase, attachment position, concept family) applies', () => {
  const corpus = buildRulingCorpus({ version: 1, rulings: [verifiedEntry()] });
  const found = lookupRuling(corpus, {
    normalised_phrase: 'true and correct in all material respects',
    attachment_position: 'CHAPEAU',
    concept_family: 'REP-T-CAP',
  });
  assert.ok(found);
  assert.equal(found.ruled_kind, 'ACCURACY');
  assert.equal(found.ruled_code, 'MAT_ALL_MATERIAL');
});

test('same phrase, different attachment position does not apply', () => {
  const corpus = buildRulingCorpus({ version: 1, rulings: [verifiedEntry({ attachment_position: 'CHAPEAU' })] });
  const found = lookupRuling(corpus, {
    normalised_phrase: 'true and correct in all material respects',
    attachment_position: 'ITEM',
    concept_family: 'REP-T-CAP',
  });
  assert.equal(found, null);
});

test('same phrase, different concept family does not apply', () => {
  const corpus = buildRulingCorpus({ version: 1, rulings: [verifiedEntry({ concept_family: 'REP-T-CAP' })] });
  const found = lookupRuling(corpus, {
    normalised_phrase: 'true and correct in all material respects',
    attachment_position: 'CHAPEAU',
    concept_family: 'REP-B-OTHER',
  });
  assert.equal(found, null);
});

test('one-character difference in the phrase does not apply (near-match never applies)', () => {
  const corpus = buildRulingCorpus({ version: 1, rulings: [verifiedEntry()] });
  const found = lookupRuling(corpus, {
    normalised_phrase: 'true and correct in all material respect', // dropped trailing "s"
    attachment_position: 'CHAPEAU',
    concept_family: 'REP-T-CAP',
  });
  assert.equal(found, null);
});

test('unverified rulings never apply', () => {
  const corpus = buildRulingCorpus({ version: 1, rulings: [verifiedEntry({ provenance_tag: 'AI' })] });
  const found = lookupRuling(corpus, {
    normalised_phrase: 'true and correct in all material respects',
    attachment_position: 'CHAPEAU',
    concept_family: 'REP-T-CAP',
  });
  assert.equal(found, null);
});

test('unverified (MECHANICAL) rulings never apply either -- only VERIFIED does', () => {
  const corpus = buildRulingCorpus({ version: 1, rulings: [verifiedEntry({ provenance_tag: 'MECHANICAL' })] });
  const found = lookupRuling(corpus, {
    normalised_phrase: 'true and correct in all material respects',
    attachment_position: 'CHAPEAU',
    concept_family: 'REP-T-CAP',
  });
  assert.equal(found, null);
});

// ─── applyRuling: mechanical application + lexicon-conflict routing ───

test('applyRuling: a VERIFIED exact match applies MECHANICAL, linked to the originating ruling', () => {
  const corpus = buildRulingCorpus({ version: 1, rulings: [verifiedEntry()] });
  const outcome = applyRuling(corpus, {
    normalised_phrase: 'true and correct in all material respects',
    attachment_position: 'CHAPEAU',
    concept_family: 'REP-T-CAP',
    classifyKind: agreeingClassifier('ACCURACY'),
  });
  assert.equal(outcome.outcome, 'APPLIED');
  assert.equal(outcome.kind, 'ACCURACY');
  assert.equal(outcome.code, 'MAT_ALL_MATERIAL');
  assert.equal(outcome.provenance.tag, 'MECHANICAL');
  assert.equal(outcome.provenance.pins.ruling_corpus_id, corpus.ruling_corpus_id);
  assert.equal(outcome.provenance.pins.ruling_corpus_version, corpus.version);
  assert.equal(typeof outcome.provenance.pins.originating_ruling_id, 'string');
  assert.equal(outcome.ruling.ruling_id, outcome.provenance.pins.originating_ruling_id);
});

test('applyRuling: no match at all returns NO_RULING, not a false application', () => {
  const outcome = applyRuling(EMPTY_RULING_CORPUS, {
    normalised_phrase: 'some quote never ruled on',
    attachment_position: 'CHAPEAU',
    concept_family: 'REP-T-CAP',
    classifyKind: abstainingClassifier(),
  });
  assert.equal(outcome.outcome, 'NO_RULING');
});

test('lexicon conflict routes: an affirmative different-kind classification blocks application', () => {
  const corpus = buildRulingCorpus({ version: 1, rulings: [verifiedEntry({ ruled_kind: 'ACCURACY' })] });
  const outcome = applyRuling(corpus, {
    normalised_phrase: 'true and correct in all material respects',
    attachment_position: 'CHAPEAU',
    concept_family: 'REP-T-CAP',
    classifyKind: agreeingClassifier('THRESHOLD'), // affirmatively disagrees
  });
  assert.equal(outcome.outcome, 'RULING_LEXICON_CONFLICT');
  assert.equal(outcome.lexicon_kind, 'THRESHOLD');
  assert.equal(outcome.ruling.ruled_kind, 'ACCURACY');
});

test('abstention is not a conflict: a null-kind classifier result still applies the ruling', () => {
  const corpus = buildRulingCorpus({ version: 1, rulings: [verifiedEntry({ ruled_kind: 'ACCURACY' })] });
  const outcome = applyRuling(corpus, {
    normalised_phrase: 'true and correct in all material respects',
    attachment_position: 'CHAPEAU',
    concept_family: 'REP-T-CAP',
    classifyKind: abstainingClassifier(),
  });
  assert.equal(outcome.outcome, 'APPLIED');
  assert.equal(outcome.kind, 'ACCURACY');
});

test('agreement is not a conflict: same-kind classification also applies', () => {
  const corpus = buildRulingCorpus({ version: 1, rulings: [verifiedEntry({ ruled_kind: 'ACCURACY' })] });
  const outcome = applyRuling(corpus, {
    normalised_phrase: 'true and correct in all material respects',
    attachment_position: 'CHAPEAU',
    concept_family: 'REP-T-CAP',
    classifyKind: agreeingClassifier('ACCURACY'),
  });
  assert.equal(outcome.outcome, 'APPLIED');
});

// ─── appendRuling ───

test('appendRuling returns a NEW corpus and never mutates the input', () => {
  const before = buildRulingCorpus({ version: 1, rulings: [] });
  const after = appendRuling(before, verifiedEntry());
  assert.deepEqual(before.rulings, []);
  assert.equal(after.rulings.length, 1);
  assert.notEqual(after.ruling_corpus_id, before.ruling_corpus_id);
  assert.equal(after.version, before.version);
});

test('appendRuling rejects a non-VERIFIED entry', () => {
  const before = buildRulingCorpus({ version: 1, rulings: [] });
  assert.throws(
    () => appendRuling(before, verifiedEntry({ provenance_tag: 'AI' })),
    (err) => err instanceof RulingCorpusError && err.code === 'NON_VERIFIED_RULING',
  );
});

test('appendRuling rejects a duplicate exact key', () => {
  const before = buildRulingCorpus({ version: 1, rulings: [verifiedEntry()] });
  assert.throws(
    () => appendRuling(before, verifiedEntry()),
    (err) => err instanceof RulingCorpusError && err.code === 'DUPLICATE_RULING_KEY',
  );
});

// ─── rulingKey ───

test('rulingKey is injective enough for the three-field key in practice', () => {
  const k1 = rulingKey({ normalised_phrase: 'a', attachment_position: 'ITEM', concept_family: 'X' });
  const k2 = rulingKey({ normalised_phrase: 'a', attachment_position: 'ITEM', concept_family: 'Y' });
  assert.notEqual(k1, k2);
});

// ─── scripts/confirm-kind-ruling.mjs: reviewer requirement + corpus write path ───
// All of these run the REAL script via child_process against a TEMP COPY of
// the corpus file. The real contracts/ file is never opened for writing by
// these tests.

function makeTempWorkspace() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ruling-corpus-test-'));
  const corpusPath = path.join(dir, 'ruling-corpus.v1.json');
  fs.writeFileSync(corpusPath, fs.readFileSync(REAL_CORPUS_PATH, 'utf8'));
  const queuePath = path.join(dir, 'review-queue.json');
  fs.writeFileSync(queuePath, JSON.stringify({
    schema_version: 'RESOLUTION_REVIEW_QUEUE/V1',
    review_queue: [
      {
        quote: 'true and correct in all material respects',
        attachment_position: 'CHAPEAU',
        concept_family: 'REP-T-CAP',
        reasons: ['QUALIFIER_KIND_DISAGREEMENT'],
      },
    ],
  }, null, 2));
  return { dir, corpusPath, queuePath };
}

function runScript(args) {
  return spawnSync(process.execPath, [CONFIRM_SCRIPT_PATH, ...args], { encoding: 'utf8' });
}

test('confirm-kind-ruling.mjs refuses to write a ruling without --reviewer', () => {
  const { corpusPath, queuePath } = makeTempWorkspace();
  const before = fs.readFileSync(corpusPath, 'utf8');

  const result = runScript([
    '--queue', queuePath,
    '--index', '0',
    '--kind', 'ACCURACY',
    '--code', 'MAT_ALL_MATERIAL',
    '--lexicon-version', '1',
    '--corpus', corpusPath,
    // --reviewer deliberately omitted
  ]);

  assert.notEqual(result.status, 0, 'script must exit non-zero without --reviewer');
  assert.match(result.stderr, /reviewer/i);
  const after = fs.readFileSync(corpusPath, 'utf8');
  assert.equal(after, before, 'the corpus file must be untouched when the script refuses');
});

test('confirm-kind-ruling.mjs appends a VERIFIED ruling and recomputes the content address, given --reviewer', () => {
  const { corpusPath, queuePath } = makeTempWorkspace();

  const result = runScript([
    '--queue', queuePath,
    '--index', '0',
    '--kind', 'ACCURACY',
    '--code', 'MAT_ALL_MATERIAL',
    '--lexicon-version', '1',
    '--corpus', corpusPath,
    '--reviewer', 'ben@example.com',
  ]);

  assert.equal(result.status, 0, `script should exit 0; stderr: ${result.stderr}`);
  const after = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));
  assert.equal(after.rulings.length, 1);
  const entry = after.rulings[0];
  assert.equal(entry.schema_version, RULING_CORPUS_ENTRY_SCHEMA);
  assert.equal(entry.normalised_phrase, 'true and correct in all material respects');
  assert.equal(entry.attachment_position, 'CHAPEAU');
  assert.equal(entry.concept_family, 'REP-T-CAP');
  assert.equal(entry.ruled_kind, 'ACCURACY');
  assert.equal(entry.ruled_code, 'MAT_ALL_MATERIAL');
  assert.equal(entry.ruler, 'ben@example.com');
  assert.equal(entry.provenance_tag, 'VERIFIED');
  assert.equal(entry.lexicon_version_at_ruling, 1);

  // The recomputed id in the file matches an independent rebuild.
  const rebuilt = buildRulingCorpus({ version: after.version, rulings: after.rulings });
  assert.equal(after.ruling_corpus_id, rebuilt.ruling_corpus_id);

  // The real contracts/ file is unaffected.
  const real = JSON.parse(fs.readFileSync(REAL_CORPUS_PATH, 'utf8'));
  assert.equal(real.rulings.length, 0);
});

test('confirm-kind-ruling.mjs refuses a queue item missing concept_family', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ruling-corpus-test-'));
  const corpusPath = path.join(dir, 'ruling-corpus.v1.json');
  fs.writeFileSync(corpusPath, fs.readFileSync(REAL_CORPUS_PATH, 'utf8'));
  const queuePath = path.join(dir, 'review-queue.json');
  fs.writeFileSync(queuePath, JSON.stringify({
    schema_version: 'RESOLUTION_REVIEW_QUEUE/V1',
    review_queue: [
      { quote: 'true and correct in all material respects', attachment_position: 'CHAPEAU' },
    ],
  }, null, 2));

  const result = runScript([
    '--queue', queuePath,
    '--index', '0',
    '--kind', 'ACCURACY',
    '--lexicon-version', '1',
    '--corpus', corpusPath,
    '--reviewer', 'ben@example.com',
  ]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /concept_family/);
  const after = fs.readFileSync(corpusPath, 'utf8');
  const before = fs.readFileSync(REAL_CORPUS_PATH, 'utf8');
  // Temp copy started identical to the real file and must still be
  // unmodified since the script failed before writing.
  assert.equal(after, before);
});

// ─── P2 (docs/superpowers/specs/2026-08-02-p2-qualifier-kinds-design.md
// section 2, audit M-2): ruling-corpus vocabulary lockstep ───

test('ruling-corpus QUALIFIER_KINDS agrees exactly with the lexicon QUALIFIER_KINDS (shared vector)', () => {
  assert.deepEqual([...QUALIFIER_KINDS].sort(), [...LEXICON_QUALIFIER_KINDS].sort());
});

test('ruling-corpus rejects a ruled_kind outside the six-kind vocabulary', () => {
  assert.throws(() => {
    validateRulingCorpus(
      buildRulingCorpus({
        version: 1,
        rulings: [verifiedEntry({ ruled_kind: 'NOT_A_KIND' })],
      })
    );
  }, RulingCorpusError);
});

test('the real committed corpus (contracts/ruling-corpus/ruling-corpus.v1.json) contains no ruling matching any P2 fixture phrase (spec section 10, test 10)', () => {
  const real = JSON.parse(fs.readFileSync(REAL_CORPUS_PATH, 'utf8'));
  validateRulingCorpus(real);
  assert.equal(real.rulings.length, 0, 'the real corpus is empty -- trivially no P2 fixture phrase is covered');
});

test('a synthetic v1-era THRESHOLD ruling on a pure carve-out phrase conflicts with the v2 lexicon (RULING_LEXICON_CONFLICT)', () => {
  const phrase = 'except as set forth in Section 3.2(b) of the Company Disclosure Letter';
  const corpus = buildRulingCorpus({
    version: 1,
    rulings: [
      verifiedEntry({
        normalised_phrase: phrase,
        attachment_position: 'ITEM',
        concept_family: 'REP-T-CAP',
        ruled_kind: 'THRESHOLD',
        lexicon_version_at_ruling: 1,
      }),
    ],
  });
  const result = applyRuling(corpus, {
    normalised_phrase: phrase,
    attachment_position: 'ITEM',
    concept_family: 'REP-T-CAP',
    classifyKind: (quote) => {
      const outcome = classifyQualifierQuote({ quote });
      return { kind: outcome.lexiconKind ?? null };
    },
  });
  assert.equal(result.outcome, 'RULING_LEXICON_CONFLICT');
  assert.equal(result.lexicon_kind, 'DISCLOSURE_SCHEDULE_CARVEOUT');
});
