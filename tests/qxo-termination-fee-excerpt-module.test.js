'use strict';

// Proves the QXO termination-fee excerpt's .txt source and its generated,
// require()'d runtime module (see lib/canonical-v2/termination-fee-serving-
// source.js's QXO_EXCERPTS_TEXT) cannot silently drift apart.
//
// The production incident this whole mechanism exists for (2026-08-05): the
// served route read the .txt directly at request time via a runtime-
// assembled path, invisible to Next's static file tracer, and the read
// silently failed on Vercel. The fix moved the served copy to a generated JS
// module reached by an ordinary literal require() -- but that only replaces
// ONE failure mode (a missing file on Vercel) with a DIFFERENT risk (a
// generated file that quietly stops matching the .txt it claims to be
// generated from). This suite is what closes that second risk: it does not
// merely compare the TEXT values, it regenerates the module's entire file
// content from the CURRENT .txt (via the exact function
// scripts/generate-qxo-termination-fee-excerpt-module.js uses to write the
// checked-in file) and requires it to be byte-identical to what is on disk.
// That makes drift impossible to miss, not merely unlikely:
//   - the .txt changes and nobody reruns the generator -> TEXT mismatch AND
//     byte-for-byte mismatch, both fail;
//   - the .generated.js file is hand-edited instead of regenerated -> the
//     byte-for-byte comparison fails even if TEXT still happens to match;
//   - the generator's own output shape changes (e.g. its header comment)
//     without rerunning it against the current .txt -> the checked-in file
//     is no longer what "regenerate right now" produces, and that fails too.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const {
  GENERATED_JS_PATH,
  SOURCE_TXT_PATH,
  renderModuleSource,
} = require('../scripts/generate-qxo-termination-fee-excerpt-module');

function currentTxtText() {
  return fs.readFileSync(SOURCE_TXT_PATH, 'utf8');
}

function currentGeneratedFileSource() {
  return fs.readFileSync(GENERATED_JS_PATH, 'utf8');
}

test('the .txt source and the generated module both exist on disk', () => {
  assert.ok(fs.existsSync(SOURCE_TXT_PATH), `missing .txt source: ${SOURCE_TXT_PATH}`);
  assert.ok(fs.existsSync(GENERATED_JS_PATH), `missing generated module: ${GENERATED_JS_PATH}`);
});

test('the generated module is byte-identical to what the generator would produce from the .txt right now', () => {
  const expected = renderModuleSource(currentTxtText());
  const actual = currentGeneratedFileSource();
  assert.equal(actual, expected, [
    'The checked-in .generated.js file no longer matches what running',
    'node scripts/generate-qxo-termination-fee-excerpt-module.js would produce',
    'from the current .txt. Either the .txt changed and the module was not',
    'regenerated, or the .generated.js file was hand-edited. Regenerate it',
    'and commit the result -- never hand-edit TEXT in the generated file.',
  ].join(' '));
});

test('the generated module\'s TEXT is exactly the .txt file\'s content, including its trailing newline', () => {
  const txtText = currentTxtText();
  // eslint-disable-next-line global-require, import/no-dynamic-require
  const generated = require('../__fixtures__/canonical-v2/qxo-termination-fee-reviewed-excerpts.generated.js');
  assert.equal(generated.TEXT, txtText);
  assert.equal(generated.TEXT.endsWith('\n'), true, 'precondition: the reviewed .txt ends with a trailing newline');
});

test('the generated module export is frozen -- it cannot be mutated in memory after require() caches it', () => {
  // eslint-disable-next-line global-require, import/no-dynamic-require
  const generated = require('../__fixtures__/canonical-v2/qxo-termination-fee-reviewed-excerpts.generated.js');
  assert.equal(Object.isFrozen(generated), true);
});

test('the byte-for-byte comparison is not vacuous: a genuinely different .txt renders genuinely different bytes', () => {
  const real = currentTxtText();
  const tampered = `${real} TAMPERED`;
  assert.notEqual(
    renderModuleSource(tampered),
    renderModuleSource(real),
    'renderModuleSource must be sensitive to its input, or the drift test above could never fail',
  );
  // And the tampered render does NOT match what is actually checked in --
  // confirms the comparison test above would catch this exact kind of drift.
  assert.notEqual(renderModuleSource(tampered), currentGeneratedFileSource());
});

test('renderModuleSource escapes the text as a single valid JS string literal (no injected identifiers)', () => {
  // eslint-disable-next-line no-new-func
  const rendered = renderModuleSource('quotes "like this", a backslash \\, and a newline\nhere');
  const loaded = new Function('module', `${rendered}\nreturn module.exports;`)({ exports: {} });
  assert.equal(loaded.TEXT, 'quotes "like this", a backslash \\, and a newline\nhere');
});
