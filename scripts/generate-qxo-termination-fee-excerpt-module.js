#!/usr/bin/env node
'use strict';

// Regenerates __fixtures__/canonical-v2/qxo-termination-fee-reviewed-excerpts.
// generated.js from __fixtures__/canonical-v2/qxo-termination-fee-reviewed-
// excerpts.txt, which stays the single reviewed source of truth (verbatim
// text from the filed QXO/TopBuild merger agreement).
//
// WHY THIS EXISTS (production incident, 2026-08-05): lib/canonical-v2/
// termination-fee-serving-source.js used to read the .txt directly at
// REQUEST time via fs.readFileSync(path.join(__dirname, ..., ...relativeParts)),
// with the path assembled from a function parameter. Next's static file
// tracer (@vercel/nft) only follows literal require()/import edges and
// simple same-scope path expressions -- a path built from a spread parameter
// passed in from a different function is invisible to it -- so the file was
// silently missing from the deployed /api/review/[id]/cards function on
// Vercel even though it is committed and .vercelignore lets it through.
// The fix: the served copy is now an ordinary, statically require()'d JS
// module (the .generated.js file this script writes). Next bundles a
// require()'d module exactly like any other code dependency; there is no
// runtime filesystem read left to miss.
//
// This script is the ONLY thing that should ever write the .generated.js
// file. Run it after editing the .txt:
//
//   node scripts/generate-qxo-termination-fee-excerpt-module.js
//
// tests/qxo-termination-fee-excerpt-module.test.js fails the build the
// moment the checked-in .generated.js stops matching what running this
// script right now would produce -- whether because the .txt changed and
// nobody regenerated, or because someone hand-edited the .generated.js
// file directly. That test is what makes drift impossible rather than
// merely discouraged: there is exactly one way to legitimately change the
// served excerpt (edit the .txt, then run this script), and any other path
// to a changed .generated.js fails it.

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const SOURCE_TXT_PATH = path.join(REPO_ROOT, '__fixtures__', 'canonical-v2', 'qxo-termination-fee-reviewed-excerpts.txt');
const GENERATED_JS_PATH = path.join(REPO_ROOT, '__fixtures__', 'canonical-v2', 'qxo-termination-fee-reviewed-excerpts.generated.js');

const HEADER = `// GENERATED FILE -- DO NOT EDIT BY HAND.
//
// Mechanically transcribed, byte-for-byte, from the single reviewed source
// of truth: __fixtures__/canonical-v2/qxo-termination-fee-reviewed-excerpts.txt
// (verbatim text from the filed QXO/TopBuild merger agreement, EDGAR
// accession 0001104659-26-045111, Ex. 2.1, §§6.2, 6.4 and 6.5(b)).
//
// Regenerate after editing the .txt:
//   node scripts/generate-qxo-termination-fee-excerpt-module.js
//
// tests/qxo-termination-fee-excerpt-module.test.js fails if this file ever
// disagrees with the .txt it was generated from, or with what regenerating
// it right now would produce. See scripts/generate-qxo-termination-fee-
// excerpt-module.js for why this file exists. Never edit TEXT below --
// edit the .txt and regenerate instead.
`;

// The generated module's entire textual content, given the source .txt's
// bytes decoded as UTF-8. Exported (not just used by generate() below) so
// the drift test can render what "regenerate right now" would produce
// without shelling out or duplicating this logic -- the test and the
// generator share exactly one implementation of "how text becomes a module".
function renderModuleSource(text) {
  return `${HEADER}\n'use strict';\n\nmodule.exports = Object.freeze({ TEXT: ${JSON.stringify(text)} });\n`;
}

function generate() {
  const text = fs.readFileSync(SOURCE_TXT_PATH, 'utf8');
  const source = renderModuleSource(text);
  fs.writeFileSync(GENERATED_JS_PATH, source);
  return { sourcePath: SOURCE_TXT_PATH, generatedPath: GENERATED_JS_PATH, text, source };
}

module.exports = {
  GENERATED_JS_PATH,
  SOURCE_TXT_PATH,
  generate,
  renderModuleSource,
};

if (require.main === module) {
  const { generatedPath } = generate();
  console.log(`Regenerated ${path.relative(REPO_ROOT, generatedPath)}`);
}
