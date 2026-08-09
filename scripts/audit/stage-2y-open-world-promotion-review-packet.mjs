#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { validatePromotionReview, renderPromotionReviewPacket } = require('../../lib/canonical-v2/open-world-promotion-review-packet');
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const CANDIDATE_ROOT = 'evidence/canonical-v2/open-world-promotion/candidates';
const DECISIONS = 'contracts/canonical-v2/governance/open-world-promotion-decisions.v1.json';
const CLUSTER_RULES = 'contracts/canonical-v2/governance/open-world-promotion-cluster-rules.v1.json';
const json = (file) => JSON.parse(readFileSync(file, 'utf8'));

function candidateSetPath(root = ROOT) {
  const directory = resolve(root, CANDIDATE_ROOT);
  const matches = readdirSync(directory).map((name) => resolve(directory, name, 'candidate-set.v1.json')).filter(existsSync);
  if (matches.length !== 1) throw new Error(`CANDIDATE_SET_COUNT_INVALID:${matches.length}`);
  return matches[0];
}
function build(root = ROOT) {
  const candidatePath = candidateSetPath(root); const candidateSet = json(candidatePath);
  const review = validatePromotionReview({ candidateSet, decisions: json(resolve(root, DECISIONS)), clusterRules: json(resolve(root, CLUSTER_RULES)) });
  return { candidatePath, review, html: renderPromotionReviewPacket(review) };
}
function assertReview(value) {
  if (value.review.candidate_count !== 15 || value.review.activation.closed !== true || value.review.decision_set_state !== 'INCOMPLETE' || !value.review.decision_validation_errors.includes('DECISION_MISSING')) throw new Error('REVIEW_PACKET_BASELINE_MISMATCH');
  if (!value.review.cards.every((card) => card.review_disposition === 'HELD' && card.activation_allowed === false)) throw new Error('REVIEW_PACKET_HOLD_MISMATCH');
}
const args = process.argv.slice(2); const value = build(); assertReview(value); const output = resolve(dirname(value.candidatePath), 'review-packet.v1.html');
if (args.length === 1 && args[0] === '--write') { writeFileSync(output, value.html); process.stdout.write(`WROTE ${output}\n`); }
else if (args.length === 1 && args[0] === '--check') { if (!existsSync(output) || readFileSync(output, 'utf8') !== value.html) throw new Error('STALE_REVIEW_PACKET'); process.stdout.write(`CHECKED ${output}\n`); }
else if (args.length === 0) process.stdout.write(`${value.review.decision_set_state}: ${value.review.candidate_count} candidates, activation closed\n`);
else throw new Error('usage: --write | --check');
export { build };
