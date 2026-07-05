const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { parseArgs } = require('../scripts/coding-task-worker');

test('coding task worker defaults to listing pending tasks', () => {
  const args = parseArgs(['node', 'script']);

  assert.equal(args.command, 'list');
  assert.equal(args.status, 'pending');
  assert.equal(args.limit, 10);
});

test('coding task worker parses claim and process commands', () => {
  const claim = parseArgs(['node', 'script', 'claim', '--limit', '3', '--worker-id', 'cli-a']);
  assert.equal(claim.command, 'claim');
  assert.equal(claim.limit, 3);
  assert.equal(claim.workerId, 'cli-a');

  const process = parseArgs(['node', 'script', '--process', '--lease-seconds', '120']);
  assert.equal(process.command, 'process');
  assert.equal(process.leaseSeconds, 120);
});

test('coding task worker parses audited status updates', () => {
  const args = parseArgs([
    'node',
    'script',
    '--needs-review',
    '11111111-1111-4111-8111-111111111111',
    '--message',
    'Rubric change drafted, parser edit pending.',
  ]);

  assert.equal(args.command, 'update');
  assert.equal(args.status, 'needs_review');
  assert.equal(args.taskId, '11111111-1111-4111-8111-111111111111');
  assert.equal(args.message, 'Rubric change drafted, parser edit pending.');
});

test('coding task worker does not import parser-v2', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'coding-task-worker.js'), 'utf8');
  assert.doesNotMatch(source, /parser-v2/);
  assert.doesNotMatch(source, /ingest-local/);
});
