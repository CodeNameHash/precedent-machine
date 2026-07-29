const { execFileSync } = require('node:child_process');
const path = require('node:path');
const universeCache = new Map();

function command(repositoryRoot, args) {
  return execFileSync('git', ['-C', repositoryRoot, ...args], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function enumerateCompleteGitAuthorshipUniverse({ repositoryRoot, expectedCommit }) {
  if (!path.isAbsolute(repositoryRoot || '')
    || !/^[a-f0-9]{40}$/.test(expectedCommit || '')) {
    throw new TypeError('an absolute repository root and exact commit are required');
  }
  const cacheKey = `${path.resolve(repositoryRoot)}\0${expectedCommit}`;
  if (universeCache.has(cacheKey)) return universeCache.get(cacheKey);
  if (command(repositoryRoot, ['rev-parse', '--is-shallow-repository']).trim() !== 'false') {
    throw new Error('review independence requires a complete non-shallow Git repository');
  }
  try {
    command(repositoryRoot, ['cat-file', '-e', `${expectedCommit}^{commit}`]);
  } catch {
    throw new Error('reviewed commit is absent from the repository');
  }
  const fields = command(repositoryRoot, [
    '-c',
    'mailmap.file=',
    '-c',
    'mailmap.blob=',
    'log',
    expectedCommit,
    '--topo-order',
    '-z',
    '--format=%H%x00%an%x00%ae%x00%cn%x00%ce',
  ]).split('\0');
  const byCommit = new Map();
  for (let index = 0; index + 4 < fields.length; index += 5) {
    const commitId = fields[index].trim();
    const identities = fields.slice(index + 1, index + 5)
      .map((value) => value.trim())
      .filter(Boolean);
    if (!/^[a-f0-9]{40}$/.test(commitId) || identities.length === 0) {
      throw new Error('Git returned an incomplete authorship event');
    }
    const identitySet = byCommit.get(commitId) || new Set();
    for (const identity of identities) identitySet.add(identity);
    byCommit.set(commitId, identitySet);
  }
  if (!byCommit.has(expectedCommit)) {
    throw new Error('reviewed commit is absent from the complete Git authorship universe');
  }
  const universe = Object.freeze([...byCommit.entries()]
    .map(([commit_id, identitySet]) => Object.freeze({
      commit_id,
      identity_set: Object.freeze([...identitySet].sort()),
    }))
    .sort((left, right) => left.commit_id.localeCompare(right.commit_id)));
  universeCache.set(cacheKey, universe);
  return universe;
}

module.exports = {
  enumerateCompleteGitAuthorshipUniverse,
};
