const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');
const walkRoot = path.join(repoRoot, 'lib', 'design', 'components');
const fixturePath = path.join(repoRoot, 'tests', 'fixtures', 'design-lint', 'violates-context-body.js');
const bannedIdentifiers = ['sectionNumber', 'section_number', 'provisionLabel'];

function walkJsFiles(root) {
  if (!fs.existsSync(root)) return [];

  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) return walkJsFiles(fullPath);
    return entry.isFile() && entry.name.endsWith('.js') ? [fullPath] : [];
  });
}

function stripCommentsAndStrings(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n\r]*/g, ' ')
    .replace(/`(?:\\[\s\S]|[^`\\])*`/g, ' ')
    .replace(/'(?:\\.|[^'\\])*'/g, ' ')
    .replace(/"(?:\\.|[^"\\])*"/g, ' ');
}

function findContextIdentifierViolations(source) {
  const stripped = stripCommentsAndStrings(source);
  return bannedIdentifiers.filter((identifier) => {
    const pattern = new RegExp(`\\b${identifier}\\b`);
    return pattern.test(stripped);
  });
}

test('design shell components do not reference context identifiers in body code', () => {
  const files = walkJsFiles(walkRoot);
  const failures = [];

  for (const file of files) {
    const violations = findContextIdentifierViolations(fs.readFileSync(file, 'utf8'));
    if (violations.length > 0) {
      failures.push(`${path.relative(repoRoot, file)}: ${violations.join(', ')}`);
    }
  }

  assert.deepEqual(failures, []);
});

test('design-lint detector catches the documented negative fixture', () => {
  const violations = findContextIdentifierViolations(fs.readFileSync(fixturePath, 'utf8'));
  assert.deepEqual(violations, bannedIdentifiers);
});

module.exports = {
  findContextIdentifierViolations,
  stripCommentsAndStrings,
  walkJsFiles,
};
