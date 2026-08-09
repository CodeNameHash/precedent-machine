#!/usr/bin/env node
'use strict';

/**
 * scripts/audit/step-2x-g-open-world-promotion-scan.js
 *
 * PLAN.md Step 2X-G: scan committed evidence/canonical-v2/<run>/resolution.json
 * for open-world shapes that recur across deals, then evaluate each against
 * lib/canonical-v2/open-world-promotion-gate.js (deal count ≥3, confidence,
 * collision / 2X-J CONSUME, 2X-B HOLD scaffolds refused).
 *
 * Zero model calls. Newest resolution per (deal, family) wins.
 *
 * Usage:
 *   node scripts/audit/step-2x-g-open-world-promotion-scan.js
 *   node scripts/audit/step-2x-g-open-world-promotion-scan.js --json
 */

const fs = require('fs');
const path = require('path');
const {
  evaluatePromotionGate,
  MIN_PROMOTION_DEAL_COUNT,
  HOLD_SCAFFOLD_MODULES,
} = require('../../lib/canonical-v2/open-world-promotion-gate');

const EVIDENCE_ROOT = path.join(__dirname, '..', '..', 'evidence', 'canonical-v2');
const DEALS = Object.freeze([
  'modiv', 'topbuild', 'concho', 'metsera', 'skechers', 'skywater', 'redhat',
]);

function parseDealFamily(name) {
  for (const deal of DEALS) {
    if (!name.startsWith(`${deal}-`)) continue;
    let rest = name.slice(deal.length + 1);
    rest = rest.replace(
      /-(?:20\d{6}.*|r\d.*|rung\d.*|replay.*|live.*|fullpin.*|withdefs.*|2x[a-z0-9-]*.*|step2.*|v2.*|nofollow.*)$/i,
      '',
    );
    return { deal, family: rest };
  }
  return null;
}

function selectNewestRuns() {
  const byKey = new Map();
  for (const ent of fs.readdirSync(EVIDENCE_ROOT, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const parsed = parseDealFamily(ent.name);
    if (!parsed) continue;
    const resolutionPath = path.join(EVIDENCE_ROOT, ent.name, 'resolution.json');
    if (!fs.existsSync(resolutionPath)) continue;
    const mtime = fs.statSync(resolutionPath).mtimeMs;
    const key = `${parsed.deal}::${parsed.family}`;
    const prev = byKey.get(key);
    if (!prev || mtime > prev.mtime) {
      byKey.set(key, {
        ...parsed,
        run: ent.name,
        mtime,
        resolutionPath,
      });
    }
  }
  return [...byKey.values()];
}

function candidateIdentity(entry) {
  const attrs = entry.attributes || {};
  const value = entry.canonical_value
    || attrs.proposed_canonical_value
    || attrs.covenant_code
    || attrs.assertion_kind
    || attrs.bucket_code
    || null;
  return `${entry.reason || '?'}::${entry.claim_definition_key || '?'}::${value || '?'}`;
}

function aggregate(runs) {
  const byIdentity = new Map();
  for (const run of runs) {
    const resolution = JSON.parse(fs.readFileSync(run.resolutionPath, 'utf8'));
    for (const entry of resolution.open_world || []) {
      const id = candidateIdentity(entry);
      let rec = byIdentity.get(id);
      if (!rec) {
        rec = {
          identity: id,
          reason: entry.reason || null,
          claim_definition_key: entry.claim_definition_key || null,
          value: entry.canonical_value
            || (entry.attributes || {}).proposed_canonical_value
            || (entry.attributes || {}).covenant_code
            || (entry.attributes || {}).assertion_kind
            || null,
          deals: new Set(),
          families: new Set(),
          quotes_by_deal: {},
          hit_count: 0,
        };
        byIdentity.set(id, rec);
      }
      rec.deals.add(run.deal);
      rec.families.add(run.family);
      rec.hit_count += 1;
      if (!rec.quotes_by_deal[run.deal]) rec.quotes_by_deal[run.deal] = [];
      if (rec.quotes_by_deal[run.deal].length < 2 && typeof entry.raw_value === 'string') {
        rec.quotes_by_deal[run.deal].push(entry.raw_value);
      }
    }
  }
  return [...byIdentity.values()]
    .map((rec) => ({
      ...rec,
      deals: [...rec.deals].sort(),
      families: [...rec.families].sort(),
    }))
    .filter((rec) => rec.deals.length >= MIN_PROMOTION_DEAL_COUNT)
    .sort((a, b) => b.deals.length - a.deals.length || b.hit_count - a.hit_count);
}

function knownTarget(rec) {
  // Already-registered governed slots the scanner can name without inventing.
  if (rec.reason === 'NO_SHOP_RUBRIC_OPEN_WORLD'
    && rec.value === 'REQUEST_RETURN_OR_DESTRUCTION_OF_INFORMATION') {
    return {
      target_governed_concept_key: 'NOSOL-CEASE',
      target_claim_definition_key: 'NO_SHOP_CEASE_ACTION',
      promotion_mechanism: 'lib/canonical-v2/native-producer/candidate-resolution.js',
      disposition_hint: 'UNGATE_REGISTERED_VALUE',
    };
  }
  if (rec.reason === 'GENERAL_COVENANT_CODE_UNCORROBORATED' && rec.value) {
    return {
      target_governed_concept_key: rec.value,
      target_claim_definition_key: 'GENERAL_COVENANT_PRESENT',
      promotion_mechanism: 'lib/canonical-v2/native-producer/general-covenant-corroboration.js',
      disposition_hint: 'PRIMARY_PATTERN_WIDEN',
      // Explicitly not the 2X-B HOLD rubric-presentation scaffold.
      hold_scaffold_refused: HOLD_SCAFFOLD_MODULES.includes(
        'lib/vocab/general-covenant-rubric-presentation.js',
      ),
    };
  }
  if (rec.reason === 'PROXY_MEETING_ASSERTION_KIND_NOT_GOVERNED') {
    return {
      target_governed_concept_key: null,
      target_claim_definition_key: null,
      proposed_concept_key: `PROXY_MEETING:${rec.value}`,
      promotion_mechanism: null,
      disposition_hint: 'NEEDS_CLAIM_DEFINITION_TAXONOMY',
    };
  }
  return {
    target_governed_concept_key: null,
    target_claim_definition_key: null,
    promotion_mechanism: null,
    disposition_hint: 'NEEDS_REVIEW',
  };
}

function main() {
  const asJson = process.argv.includes('--json');
  const runs = selectNewestRuns();
  const candidates = aggregate(runs).map((rec) => {
    const target = knownTarget(rec);
    const gate = evaluatePromotionGate({
      deal_ids: rec.deals,
      quotes_by_deal: rec.quotes_by_deal,
      identity_keys: [rec.identity],
      proposed_concept_key: target.proposed_concept_key || null,
      target_governed_concept_key: target.target_governed_concept_key || null,
      target_claim_definition_key: target.target_claim_definition_key || null,
      promotion_mechanism: target.promotion_mechanism || null,
    });
    return {
      identity: rec.identity,
      reason: rec.reason,
      claim_definition_key: rec.claim_definition_key,
      value: rec.value,
      deal_count: rec.deals.length,
      deals: rec.deals,
      families: rec.families,
      hit_count: rec.hit_count,
      sample_quotes: Object.fromEntries(
        Object.entries(rec.quotes_by_deal).map(([deal, quotes]) => [deal, quotes.map((q) => q.slice(0, 180))]),
      ),
      disposition_hint: target.disposition_hint,
      gate,
    };
  });

  const passing = candidates.filter((c) => c.gate.ok);
  if (asJson) {
    process.stdout.write(`${JSON.stringify({
      generated_at: new Date().toISOString(),
      runs_selected: runs.length,
      min_deal_count: MIN_PROMOTION_DEAL_COUNT,
      candidates_ge_min_deals: candidates.length,
      gate_pass: passing.length,
      candidates,
    }, null, 2)}\n`);
    return;
  }

  console.log(`Step 2X-G open-world promotion scan`);
  console.log(`runs selected: ${runs.length}`);
  console.log(`shapes with ≥${MIN_PROMOTION_DEAL_COUNT} deals: ${candidates.length}`);
  console.log(`gate PASS: ${passing.length}`);
  console.log('');
  for (const c of candidates.slice(0, 25)) {
    const mark = c.gate.ok ? 'PASS' : `FAIL(${c.gate.refusals.join(',')})`;
    console.log(`[${mark}] ${c.deal_count}d/${c.hit_count}h  ${c.reason}  value=${c.value}`);
    console.log(`  deals=${c.deals.join(',')}  hint=${c.disposition_hint}`);
    const firstDeal = c.deals[0];
    const q = (c.sample_quotes[firstDeal] || [])[0];
    if (q) console.log(`  quote[${firstDeal}]: ${q}`);
    console.log('');
  }
}

main();
