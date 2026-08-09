'use strict';

/**
 * lib/canonical-v2/marker-start-git-baseline.js
 *
 * Read-only Git inspector for Step 2X derived-limb marker-start stability.
 * Loads a historical `lib/parser-v2/subclauses.js` blob via `git show` and
 * returns its source text. Does not write files.
 *
 * Classified READ_ONLY_GIT_INSPECTOR: the only process launch is
 * `execFileSync('git', ['show', ...])`. The survey script that consumes this
 * text (`scripts/canonical-v2-marker-start-stability.mjs`) owns any local
 * artefact writes.
 */

const childProcess = require('node:child_process');
const path = require('node:path');

const DEFAULT_REPO_ROOT = path.resolve(__dirname, '..', '..');
const SEGMENTER_RELATIVE_PATH = 'lib/parser-v2/subclauses.js';

/**
 * @param {string} ref git commit-ish
 * @param {{ repositoryRoot?: string }} [opts]
 * @returns {string} file contents at ref
 */
function loadSubclausesSourceFromGit(ref, { repositoryRoot = DEFAULT_REPO_ROOT } = {}) {
  if (typeof ref !== 'string' || ref.length === 0) {
    throw new TypeError('ref must be a non-empty string');
  }
  return childProcess.execFileSync(
    'git',
    ['show', `${ref}:${SEGMENTER_RELATIVE_PATH}`],
    {
      cwd: repositoryRoot,
      encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
}

module.exports = Object.freeze({
  SEGMENTER_RELATIVE_PATH,
  loadSubclausesSourceFromGit,
});
