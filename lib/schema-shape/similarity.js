const fs = require('fs');

function normalize(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function tokens(text) {
  return normalize(text).split(/\s+/).filter(Boolean);
}

function jaccard(a, b) {
  const aa = new Set(tokens(a));
  const bb = new Set(tokens(b));
  if (!aa.size && !bb.size) return 1;
  const intersection = [...aa].filter((item) => bb.has(item)).length;
  return intersection / new Set([...aa, ...bb]).size;
}

function levenshtein(a, b) {
  const left = normalize(a);
  const right = normalize(b);
  const dp = Array.from({ length: left.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= right.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  const longest = Math.max(left.length, right.length, 1);
  return 1 - dp[left.length][right.length] / longest;
}

function readDefinitions(file = 'docs/schema-shape/canonical-definitions.md') {
  const text = fs.readFileSync(file, 'utf8');
  return text.split(/\n---\n/).map((block) => {
    const match = block.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/) || block.match(/^([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) return null;
    const frontmatter = match[1].split(/\r?\n/).reduce((out, line) => {
      const pair = line.match(/^([A-Za-z_]+):\s*(.*)$/);
      if (pair) out[pair[1]] = pair[2];
      return out;
    }, {});
    return { ...frontmatter, body: match[2] || '' };
  }).filter((entry) => entry?.key);
}

function rankCandidates(rawValue, field, options = {}) {
  const definitions = options.definitions || readDefinitions();
  const priors = options.priors || {};
  const fieldDefinitions = definitions.filter((entry) => !field?.vocab || entry.vocab === field.vocab);
  return fieldDefinitions.map((entry) => {
    const string = Math.max(jaccard(rawValue, `${entry.key} ${entry.label}`), levenshtein(rawValue, entry.label));
    const context = field?.shape && entry.body.includes(field.shape) ? 1 : 0.5;
    const prior = priors[`${normalize(rawValue)}:${entry.key}`] || 0;
    const total = Number((string * 0.35 + context * 0.45 + prior * 0.20).toFixed(6));
    return {
      key: entry.key,
      label: entry.label,
      score: { string: Number(string.toFixed(6)), context, priors: prior, total },
    };
  }).sort((a, b) => b.score.total - a.score.total || a.key.localeCompare(b.key));
}

module.exports = {
  jaccard,
  levenshtein,
  normalize,
  rankCandidates,
  readDefinitions,
};
