#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

function scanClosingConditionScope(root = process.cwd()) {
  const targets = [
    ...walk(path.join(root, 'components', 'review')),
    ...walk(path.join(root, 'pages', 'review')),
  ].filter((file) => /\.(js|jsx)$/.test(file));
  const bad = [];
  const pattern = /closing.condition[\s\S]{0,240}(burdensome|Substantial Detriment)|(burdensome|Substantial Detriment)[\s\S]{0,240}closing.condition/i;
  for (const file of targets) {
    const src = fs.readFileSync(file, 'utf8');
    if (pattern.test(src)) bad.push(path.relative(root, file));
  }
  return bad;
}

function main() {
  const bad = scanClosingConditionScope();
  if (bad.length) {
    process.stdout.write(`INVARIANT-3: FAIL closing-condition contamination in ${bad.join(', ')}\n`);
    process.exit(1);
  }
  process.stdout.write('INVARIANT-3: PASS\n');
}

if (require.main === module) {
  main();
}

module.exports = { scanClosingConditionScope };
