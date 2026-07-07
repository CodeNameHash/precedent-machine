const fs = require('fs');

const RAW_FEATURE_PATTERNS = [
  /\bfeatures\s*\.\s*[A-Za-z_$][\w$]*/g,
  /\bfeatures\s*\[\s*['"`][A-Za-z0-9_.-]+['"`]\s*\]/g,
  /\bgetFeatures\s*\([^)]*\)\s*\.\s*[A-Za-z_$][\w$]*/g,
  /\bgetFeatures\s*\([^)]*\)\s*\[\s*['"`][A-Za-z0-9_.-]+['"`]\s*\]/g,
];

function stripComments(source) {
  return String(source || '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function rawFeatureKeyViolations(source, file = '<source>') {
  const body = stripComments(source);
  const violations = [];
  for (const pattern of RAW_FEATURE_PATTERNS) {
    for (const match of body.matchAll(pattern)) {
      const before = body.slice(0, match.index);
      const line = before.split('\n').length;
      violations.push({ file, line, match: match[0] });
    }
  }
  return violations;
}

function rawFeatureKeyViolationsInFile(file) {
  return rawFeatureKeyViolations(fs.readFileSync(file, 'utf8'), file);
}

module.exports = {
  rawFeatureKeyViolations,
  rawFeatureKeyViolationsInFile,
};
