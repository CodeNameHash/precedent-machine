const fs = require('node:fs');
const path = require('node:path');

const NORMALIZED_FILE = 'docs/schema-shape/normalized-v1.json';
const WORKLOG_FILE = 'WORKLOG-P0-D.md';

const MUTATING_DECISIONS = new Set(['reassign-attribute', 'reassign-party', 'reassign-canonical', 'quarantine']);

function assertNotFrozenPath(file) {
  const normalised = file.split(path.sep).join('/');
  if (/docs\/vocab\/FROZEN-.*\.json$/.test(normalised) || /docs\/market-registry\/FROZEN-.*\.json$/.test(normalised)) {
    throw new Error(`Refusing to write frozen schema file: ${file}`);
  }
}

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function claimMatches(claim, decision) {
  if (decision.claim_id && claim.id === decision.claim_id) return true;
  if (decision.claim_hash && decision.hashClaim) return decision.hashClaim(claim) === decision.claim_hash;
  return false;
}

function mutateClaim(claim, decision) {
  if (decision.decision_type === 'reassign-attribute') {
    return { ...claim, field_key: decision.target_field_key || decision.field_key || claim.field_key };
  }
  if (decision.decision_type === 'reassign-party') {
    return { ...claim, party_scope: decision.target_party_scope || decision.party_scope || claim.party_scope || null };
  }
  if (decision.decision_type === 'reassign-canonical') {
    return {
      ...claim,
      canonicalKey: decision.target_canonicalKey || decision.canonicalKey || claim.canonicalKey,
      raw_value: decision.target_raw_value ?? decision.raw_value ?? claim.raw_value,
    };
  }
  return claim;
}

function appendWorklog(file, decision, result) {
  fs.mkdirSync(path.dirname(file) === '.' ? process.cwd() : path.dirname(file), { recursive: true });
  fs.appendFileSync(
    file,
    `\n## ${new Date().toISOString()} schema-loss ${decision.decision_type}\n\n` +
      `- claim: ${decision.claim_id || decision.claim_hash || 'unknown'}\n` +
      `- result: ${result}\n`
  );
}

function applyDecision(decision, { normalizedFile = NORMALIZED_FILE, worklogFile = WORKLOG_FILE } = {}) {
  if (!MUTATING_DECISIONS.has(decision.decision_type)) {
    return { changed: false, result: 'non-mutating decision ignored by apply script' };
  }
  assertNotFrozenPath(normalizedFile);
  assertNotFrozenPath(worklogFile);
  const normalized = readJson(normalizedFile, { triples: [] });
  let changed = false;
  let removed = false;
  normalized.triples = (normalized.triples || []).flatMap((claim) => {
    if (!claimMatches(claim, decision)) return [claim];
    changed = true;
    if (decision.decision_type === 'quarantine') {
      removed = true;
      return [];
    }
    return [mutateClaim(claim, decision)];
  });
  if (!changed) return { changed: false, result: 'claim not found' };
  fs.writeFileSync(normalizedFile, `${JSON.stringify(normalized, null, 2)}\n`);
  const result = removed ? 'claim quarantined' : 'claim reassigned';
  appendWorklog(worklogFile, decision, result);
  return { changed: true, result };
}

if (require.main === module) {
  const decision = JSON.parse(process.argv[2] || '{}');
  const result = applyDecision(decision);
  console.log(JSON.stringify(result));
}

module.exports = {
  applyDecision,
  assertNotFrozenPath,
  MUTATING_DECISIONS,
};
