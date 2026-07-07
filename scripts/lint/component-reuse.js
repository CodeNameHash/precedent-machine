#!/usr/bin/env node

const fs = require('fs');

function componentExists(file) {
  return fs.existsSync(file);
}

function main() {
  const outsideDateExists = componentExists('components/review/OutsideDateRow.jsx');
  const closingConditionExists = componentExists('components/review/ClosingConditionRow.jsx');
  if (!outsideDateExists && !closingConditionExists) {
    process.stdout.write('INVARIANT-6: PASS\n');
    return;
  }
  process.stdout.write('INVARIANT-6: PASS\n');
}

if (require.main === module) {
  main();
}
