import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const {
  buildF27Inputs,
} = require('../tests/fixtures/canonical-v2/qxo-capitalisation-f27-inputs');
const {
  buildQxoReviewedCapitalisationF27,
} = require('../lib/canonical-v2/reviewed-qxo-capitalisation-f27');
const {
  buildQxoCapitalisationCrossViewReleaseF27,
  buildQxoCapitalisationF27Preview,
} = require('../lib/canonical-v2/qxo-capitalisation-cross-view-release-f27');

const inputs = buildF27Inputs();
const reviewedGraph = buildQxoReviewedCapitalisationF27(inputs);
const release = buildQxoCapitalisationCrossViewReleaseF27({
  reviewedGraph,
  sourceContext: inputs.sourceContext,
  parserSourceClosure: inputs.parserSourceClosure,
  contractBundle: inputs.contractBundle,
});
const output = `${JSON.stringify(
  buildQxoCapitalisationF27Preview(release),
  null,
  2,
)}\n`;
const target = path.join(
  root,
  '__fixtures__',
  'canonical-v2',
  'qxo-capitalisation-bring-down-f27.json',
);

if (process.argv.includes('--check')) {
  if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== output) {
    throw new Error('the committed QXO F27 preview fixture has drifted');
  }
} else {
  fs.writeFileSync(target, output);
}
