#!/usr/bin/env node

const path = require('node:path');
const { createEntry } = require('../../lib/review-queue/create');

const REPO_URL = 'https://github.com/CodeNameHash/precedent-machine';

function parseArgs(argv = process.argv.slice(2)) {
  const args = { evidence: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    const value = argv[index + 1];
    if (value == null || value.startsWith('--')) throw new Error(`Missing value for --${key}`);
    index += 1;
    if (key === 'evidence') args.evidence.push(parseEvidence(value));
    else args[key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
  }
  return args;
}

function parseEvidence(value) {
  const separator = String(value).indexOf('=');
  if (separator <= 0) throw new Error(`Evidence must be label=url: ${value}`);
  return {
    label: value.slice(0, separator).trim(),
    url: value.slice(separator + 1).trim(),
  };
}

function prNumber(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) throw new Error(`Invalid PR number: ${value}`);
  return number;
}

function choicesForPr(pr) {
  if (!pr) return null;
  return [
    { key: 'approve', label: 'Approve as proposed', codex_action: `self-merge PR #${pr}` },
    { key: 'reject', label: 'Reject', codex_action: `close PR #${pr} and comment with reason` },
    { key: 'modify', label: 'Approve with changes', codex_action: `await Ben-authored diff for PR #${pr}, apply, self-merge` },
  ];
}

function inputFromArgs(args) {
  const pr = prNumber(args.pr);
  const evidence = [...args.evidence];
  if (pr) {
    evidence.unshift({
      label: `PR #${pr}`,
      url: `${REPO_URL}/pull/${pr}`,
    });
  }
  return {
    id: args.id,
    kind: args.kind,
    title: args.title,
    summary: args.summary,
    evidence,
    choices: choicesForPr(pr) || undefined,
  };
}

function run(argv = process.argv.slice(2), options = {}) {
  const args = parseArgs(argv);
  const root = options.root || process.env.REVIEW_QUEUE_ROOT || process.cwd();
  const entry = createEntry(inputFromArgs(args), { root, now: options.now });
  return {
    ok: true,
    entry,
    file: path.join(root, 'docs', 'review-queue', `${entry.id}.json`),
  };
}

function main() {
  try {
    process.stdout.write(`${JSON.stringify(run(), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  choicesForPr,
  inputFromArgs,
  parseArgs,
  parseEvidence,
  prNumber,
  run,
};
