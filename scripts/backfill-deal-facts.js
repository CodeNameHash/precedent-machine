#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { buildPartiesFact, buildValueUsdFact } = require('../lib/deal-facts');

const PAGE_SIZE = 1000;

function loadDotEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
}

function parseArgs(argv) {
  const args = { all: false, deal: null, apply: false };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--all') args.all = true;
    else if (arg === '--deal') args.deal = argv[++i];
    else if (arg === '--apply') args.apply = true;
    else if (arg === '--dry-run') args.apply = false;
    else throw new Error(`Unknown arg: ${arg}`);
  }
  if (args.all && args.deal) throw new Error('Use --all or --deal, not both');
  if (!args.all && !args.deal) throw new Error('Usage: node scripts/backfill-deal-facts.js (--all | --deal <substring-or-id>) [--apply]');
  if (args.deal && !String(args.deal).trim()) throw new Error('--deal requires a non-empty value');
  return args;
}

function safeMeta(row) {
  return row && row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata) ? row.metadata : {};
}

function compact(value) {
  return String(value || '').trim();
}

function normaliseUrl(value) {
  const raw = compact(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return raw.replace(/\/$/, '');
  }
}

function sha256(text) {
  return crypto.createHash('sha256').update(String(text || ''), 'utf8').digest('hex');
}

function uniqueNonEmpty(values) {
  return [...new Set(values.map(compact).filter(Boolean))];
}

function candidateValue(candidate) {
  const verification = candidate && candidate.priority_verification && typeof candidate.priority_verification === 'object'
    ? candidate.priority_verification
    : {};
  const candidates = [
    candidate && candidate.deal_value_usd,
    candidate && candidate.effective_value_usd,
    verification.value_usd,
    verification.verified_value_usd,
  ];
  for (const raw of candidates) {
    const value = Number(raw);
    if (Number.isFinite(value) && value > 0) return Math.round(value);
  }
  return null;
}

function candidateValueSource(candidate) {
  const verification = candidate && candidate.priority_verification && typeof candidate.priority_verification === 'object'
    ? candidate.priority_verification
    : {};
  if (verification.value_usd || verification.verified_value_usd || verification.source_label) {
    return {
      source_url: verification.source_url || candidate.agreement_exhibit_url || null,
      source_label: verification.source_label || 'Seed priority verification',
      method: 'priority_verification',
    };
  }
  return {
    source_url: candidate && candidate.agreement_exhibit_url,
    source_label: 'EDGAR candidate metadata',
    method: 'candidate_metadata',
  };
}

function verifiedValueFromDeal(deal) {
  const meta = safeMeta(deal);
  const seed = meta.seed_ingest && typeof meta.seed_ingest === 'object' ? meta.seed_ingest : {};
  const verification = seed.priority_verification && typeof seed.priority_verification === 'object' ? seed.priority_verification : {};
  const candidates = [
    verification.value_usd,
    verification.verified_value_usd,
    seed.candidate_deal_value_usd,
    meta.candidate_deal_value_usd,
    meta.seedCandidateDealValueUsd,
  ];
  for (const raw of candidates) {
    const value = Number(raw);
    if (Number.isFinite(value) && value > 0) {
      return {
        value: Math.round(value),
        source_url: verification.source_url || meta.source_url || meta.agreement_exhibit_url || null,
        source_label: verification.source_label || 'Seed ingest metadata',
        method: verification.source_label ? 'priority_verification' : 'candidate_metadata',
      };
    }
  }
  return null;
}

function sourceUrlsFromDeal(deal) {
  const meta = safeMeta(deal);
  const facts = meta.deal_facts && typeof meta.deal_facts === 'object' ? meta.deal_facts : {};
  return uniqueNonEmpty([
    meta.source_url,
    meta.agreement_exhibit_url,
    meta.agreementExhibitUrl,
    facts.value_usd && facts.value_usd.source_url,
    facts.parties && facts.parties.source_url,
  ]).map(normaliseUrl).filter(Boolean);
}

function candidateIdsFromDeal(deal) {
  const meta = safeMeta(deal);
  const seed = meta.seed_ingest && typeof meta.seed_ingest === 'object' ? meta.seed_ingest : {};
  return uniqueNonEmpty([
    seed.candidate_id,
    meta.seedCandidateId,
    meta.seed_candidate_id,
    meta.candidate_id,
  ]);
}

function hashesFromDeal(deal) {
  const meta = safeMeta(deal);
  const hashes = uniqueNonEmpty([
    meta.agreement_text_hash,
    meta.agreementTextHash,
    meta.source_text_hash,
    meta.sourceTextHash,
  ]);
  if (typeof meta.full_text === 'string' && meta.full_text.length > 0) hashes.push(sha256(meta.full_text));
  return [...new Set(hashes)];
}

function indexCandidates(candidates) {
  const byId = new Map();
  const byUrl = new Map();
  const byHash = new Map();
  const byIngestedDeal = new Map();
  for (const candidate of candidates || []) {
    if (!candidate || !candidate.id) continue;
    byId.set(String(candidate.id), candidate);
    const url = normaliseUrl(candidate.agreement_exhibit_url);
    if (url) {
      if (!byUrl.has(url)) byUrl.set(url, []);
      byUrl.get(url).push(candidate);
    }
    if (candidate.agreement_text_hash) {
      const hash = String(candidate.agreement_text_hash);
      if (!byHash.has(hash)) byHash.set(hash, []);
      byHash.get(hash).push(candidate);
    }
    if (candidate.ingested_deal_id) {
      const dealId = String(candidate.ingested_deal_id);
      if (!byIngestedDeal.has(dealId)) byIngestedDeal.set(dealId, []);
      byIngestedDeal.get(dealId).push(candidate);
    }
  }
  return { byId, byUrl, byHash, byIngestedDeal };
}

function manifestCandidatesFromFile(file) {
  if (!fs.existsSync(file)) return [];
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  const rows = Array.isArray(parsed) ? parsed : parsed.candidates || parsed.deals || [];
  return rows.map((row) => ({
    id: row.candidate_id || row.id || null,
    deal_value_usd: row.value_usd || row.deal_value_usd || null,
    effective_value_usd: row.effective_value_usd || null,
    agreement_exhibit_url: row.agreement_exhibit_url || row.url || null,
    agreement_text_hash: row.agreement_text_hash || null,
    priority_verification: row.priority_verification || null,
  })).filter((row) => row.id || row.agreement_exhibit_url || row.agreement_text_hash);
}

function mergeCandidateFacts(candidates, manifestRows) {
  const byId = new Map();
  const byUrl = new Map();
  const byHash = new Map();
  for (const row of manifestRows || []) {
    if (row.id) byId.set(String(row.id), row);
    const url = normaliseUrl(row.agreement_exhibit_url);
    if (url) byUrl.set(url, row);
    if (row.agreement_text_hash) byHash.set(String(row.agreement_text_hash), row);
  }
  return (candidates || []).map((candidate) => {
    const manifest = byId.get(String(candidate.id))
      || byUrl.get(normaliseUrl(candidate.agreement_exhibit_url))
      || byHash.get(String(candidate.agreement_text_hash || ''))
      || null;
    if (!manifest) return candidate;
    return {
      ...candidate,
      deal_value_usd: candidate.deal_value_usd || manifest.deal_value_usd || null,
      effective_value_usd: candidate.effective_value_usd || manifest.effective_value_usd || null,
      priority_verification: candidate.priority_verification || manifest.priority_verification || null,
      agreement_text_hash: candidate.agreement_text_hash || manifest.agreement_text_hash || null,
    };
  });
}

function pushUniqueMatch(matches, candidate, method) {
  if (!candidate || !candidate.id) return;
  const existing = matches.find((match) => String(match.candidate.id) === String(candidate.id));
  if (existing) existing.methods.push(method);
  else matches.push({ candidate, methods: [method] });
}

function singleIndexedHit(list, method, skipped) {
  if (!list || list.length === 0) return null;
  if (list.length > 1) {
    skipped.push(`${method} matched ${list.length} candidates`);
    return null;
  }
  return list[0];
}

function matchCandidateForDeal(deal, indexes) {
  const skipped = [];
  const matches = [];

  const ingestedHits = indexes.byIngestedDeal.get(String(deal.id));
  pushUniqueMatch(matches, singleIndexedHit(ingestedHits, 'ingested_deal_id', skipped), 'ingested_deal_id');

  for (const candidateId of candidateIdsFromDeal(deal)) {
    pushUniqueMatch(matches, indexes.byId.get(candidateId), `candidate_id:${candidateId}`);
  }
  for (const url of sourceUrlsFromDeal(deal)) {
    pushUniqueMatch(matches, singleIndexedHit(indexes.byUrl.get(url), `source_url:${url}`, skipped), `source_url:${url}`);
  }
  for (const hash of hashesFromDeal(deal)) {
    pushUniqueMatch(matches, singleIndexedHit(indexes.byHash.get(hash), `agreement_text_hash:${hash}`, skipped), `agreement_text_hash:${hash}`);
  }

  if (matches.length === 0) {
    return { candidate: null, matched_source: null, skipped_reason: skipped[0] || 'no exact source/candidate/hash match' };
  }
  if (matches.length > 1) {
    return {
      candidate: null,
      matched_source: null,
      skipped_reason: `conflicting candidate matches: ${matches.map((m) => m.candidate.id).join(', ')}`,
    };
  }
  return {
    candidate: matches[0].candidate,
    matched_source: matches[0].methods.join(', '),
    skipped_reason: null,
  };
}

function hasFactValue(fact) {
  return fact && typeof fact === 'object' && fact.value !== null && fact.value !== undefined && fact.value !== '';
}

function hasRowValue(deal) {
  const n = Number(deal && deal.value_usd);
  return Number.isFinite(n) && n > 0;
}

function buildCandidateParties(deal, candidate) {
  const acquirerDisplay = compact(candidate && candidate.acquirer_name) || null;
  const targetDisplay = compact(candidate && candidate.target_name) || null;
  if (!acquirerDisplay && !targetDisplay) return null;
  return buildPartiesFact({
    acquirer: compact(deal && deal.acquirer) || acquirerDisplay,
    target: compact(deal && deal.target) || targetDisplay,
    parent_entity: acquirerDisplay,
    target_entity: targetDisplay,
    acquirer_display: acquirerDisplay,
    target_display: targetDisplay,
  }, {
    source_url: candidate && candidate.agreement_exhibit_url,
    source_label: 'EDGAR candidate metadata',
    method: 'candidate_metadata',
  });
}

function buildStoredParties(deal) {
  const meta = safeMeta(deal);
  const values = {
    acquirer: compact(deal && deal.acquirer) || null,
    target: compact(deal && deal.target) || null,
    parent_entity: compact(meta.parent_entity) || compact(deal && deal.acquirer) || null,
    target_entity: compact(meta.target_entity) || compact(deal && deal.target) || null,
    acquirer_display: compact(meta.acquirer_display) || compact(meta.parent_entity) || null,
    target_display: compact(meta.target_display) || compact(meta.target_entity) || null,
  };
  if (!values.parent_entity && !values.target_entity && !values.acquirer_display && !values.target_display) return null;
  return buildPartiesFact(values, {
    source_url: meta.source_url || meta.agreement_exhibit_url || null,
    source_label: 'Stored deal metadata',
    method: 'stored_deal_metadata',
  });
}

function mergeMissingFact(currentFact, candidateFact) {
  if (!candidateFact) return { fact: currentFact || null, changed: false };
  const base = currentFact && typeof currentFact === 'object' && !Array.isArray(currentFact) ? currentFact : {};
  let changed = false;
  const next = { ...base };
  for (const [key, value] of Object.entries(candidateFact)) {
    if (value === null || value === undefined || value === '') continue;
    if (next[key] === null || next[key] === undefined || next[key] === '') {
      next[key] = value;
      changed = true;
    }
  }
  return { fact: changed || Object.keys(base).length ? next : null, changed };
}

function missingPartyPatch(currentParties, candidateParties, candidateId) {
  if (!candidateParties) return null;
  const current = currentParties && typeof currentParties === 'object' && !Array.isArray(currentParties) ? currentParties : null;
  if (!current) return { ...candidateParties, source_candidate_id: candidateId };

  const patch = {};
  for (const key of ['parent_entity', 'target_entity', 'acquirer_display', 'target_display']) {
    if (
      candidateParties[key] !== null
      && candidateParties[key] !== undefined
      && candidateParties[key] !== ''
      && (current[key] === null || current[key] === undefined || current[key] === '')
    ) {
      patch[key] = candidateParties[key];
    }
  }
  if (Object.keys(patch).length === 0) return null;
  for (const key of ['source_url', 'source_label', 'method', 'updated_at', 'locked']) {
    if (candidateParties[key] !== null && candidateParties[key] !== undefined && (current[key] === null || current[key] === undefined || current[key] === '')) {
      patch[key] = candidateParties[key];
    }
  }
  if (current.source_candidate_id === null || current.source_candidate_id === undefined || current.source_candidate_id === '') {
    patch.source_candidate_id = candidateId;
  }
  return patch;
}

function proposedPatch(deal, candidate, matchedSource) {
  const meta = safeMeta(deal);
  const facts = meta.deal_facts && typeof meta.deal_facts === 'object' && !Array.isArray(meta.deal_facts) ? meta.deal_facts : {};
  const verifiedValue = verifiedValueFromDeal(deal);
  const value = candidateValue(candidate) || (verifiedValue && verifiedValue.value) || null;
  const candidateParties = buildCandidateParties(deal, candidate) || buildStoredParties(deal);
  const nextFacts = { ...facts };
  const update = {};
  const proposed = {
    value_usd: value,
    acquirer_display: candidateParties && candidateParties.acquirer_display,
    target_display: candidateParties && candidateParties.target_display,
  };
  let metadataChanged = false;

  if (value && !hasRowValue(deal)) update.value_usd = value;
  if (value && !hasFactValue(facts.value_usd)) {
    const candidateSource = candidateValueSource(candidate);
    nextFacts.value_usd = {
      ...buildValueUsdFact(value, {
        source_url: (verifiedValue && verifiedValue.source_url) || candidateSource.source_url || null,
        source_label: (verifiedValue && verifiedValue.source_label) || candidateSource.source_label,
        method: (verifiedValue && verifiedValue.method) || candidateSource.method,
      }),
      source_candidate_id: candidate && candidate.id,
    };
    metadataChanged = true;
  }

  const partyPatch = missingPartyPatch(facts.parties, candidateParties, candidate && candidate.id);
  const partyMerge = mergeMissingFact(facts.parties, partyPatch);
  if (partyPatch && partyMerge.changed) {
    nextFacts.parties = partyMerge.fact;
    metadataChanged = true;
  }

  if (metadataChanged) update.metadata = { ...meta, deal_facts: nextFacts };

  const missingSourceFacts = [];
  if (!value) missingSourceFacts.push('candidate has no deal_value_usd');
  if (!candidateParties || (!candidateParties.acquirer_display && !candidateParties.target_display)) {
    missingSourceFacts.push('candidate has no party names');
  }

  return {
    matched_source: matchedSource,
    proposed,
    update,
    skipped_reason: Object.keys(update).length ? null : `no missing fields to update${missingSourceFacts.length ? ` (${missingSourceFacts.join('; ')})` : ''}`,
  };
}

function dealMatchesFilter(deal, args) {
  if (args.all) return true;
  const needle = String(args.deal || '').toLowerCase();
  return String(deal.id || '').toLowerCase() === needle
    || `${deal.acquirer || ''} ${deal.target || ''}`.toLowerCase().includes(needle);
}

async function fetchPaged(sb, table, select, orderColumn) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    let query = sb.from(table).select(select).range(offset, offset + PAGE_SIZE - 1);
    if (orderColumn) query = query.order(orderColumn, { ascending: true });
    const { data, error } = await query;
    if (error) throw new Error(`${table} fetch failed: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

function formatMoney(value) {
  if (!value) return '(none)';
  return `$${Number(value).toLocaleString('en-US')}`;
}

function formatParty(value) {
  return value || '(none)';
}

function dealLabel(deal) {
  return `${deal.acquirer || '?'} / ${deal.target || '?'} (${deal.id})`;
}

async function applyUpdate(sb, deal, update) {
  const { error } = await sb.from('deals').update(update).eq('id', deal.id);
  if (error) throw new Error(error.message);
}

async function main() {
  loadDotEnvLocal();
  const args = parseArgs(process.argv);
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (env / .env.local)');

  const { createClient } = require('@supabase/supabase-js');
  const sb = createClient(url, key);
  const [deals, rawCandidates] = await Promise.all([
    fetchPaged(sb, 'deals', 'id,acquirer,target,value_usd,metadata,created_at', 'created_at'),
    fetchPaged(sb, 'deal_candidates', 'id,acquirer_name,target_name,deal_value_usd,agreement_exhibit_url,agreement_text_hash,ingested_deal_id,filing_accession,filing_date,status', 'filing_date'),
  ]);
  const manifestRows = [
    ...manifestCandidatesFromFile(path.join(__dirname, '..', 'docs/ingest/seed-50-priority-deals.json')),
    ...manifestCandidatesFromFile(path.join(__dirname, '..', 'docs/ingest/seed-50-manifest-2026-07-05.json')),
  ];
  const candidates = mergeCandidateFacts(rawCandidates, manifestRows);
  const indexes = indexCandidates(candidates);
  const selectedDeals = deals.filter((deal) => dealMatchesFilter(deal, args));

  console.log(`Backfill deal facts - ${args.apply ? 'APPLY' : 'dry-run'} - deals=${selectedDeals.length} candidates=${candidates.length}`);

  let matched = 0;
  let writable = 0;
  let written = 0;
  let skipped = 0;
  let failed = 0;

  for (const deal of selectedDeals) {
    const match = matchCandidateForDeal(deal, indexes);
    if (!match.candidate) {
      skipped += 1;
      console.log(`${dealLabel(deal)}\n  matched source: (none)\n  proposed value: (none)\n  proposed display parties: buyer=(none), target=(none)\n  skipped: ${match.skipped_reason}`);
      continue;
    }

    matched += 1;
    const patch = proposedPatch(deal, match.candidate, match.matched_source);
    if (Object.keys(patch.update).length) writable += 1;
    else skipped += 1;

    console.log(`${dealLabel(deal)}\n  matched source: ${patch.matched_source} -> candidate ${match.candidate.id}`);
    console.log(`  proposed value: ${formatMoney(patch.proposed.value_usd)}`);
    console.log(`  proposed display parties: buyer=${formatParty(patch.proposed.acquirer_display)}, target=${formatParty(patch.proposed.target_display)}`);

    if (patch.skipped_reason) {
      console.log(`  skipped: ${patch.skipped_reason}`);
      continue;
    }
    if (!args.apply) {
      const fields = Object.keys(patch.update).join(', ');
      console.log(`  dry-run: would update ${fields}`);
      continue;
    }
    try {
      await applyUpdate(sb, deal, patch.update);
      written += 1;
      console.log('  written.');
    } catch (err) {
      failed += 1;
      console.log(`  UPDATE FAILED: ${err.message}`);
    }
  }

  console.log(`Done. matched=${matched} writable=${writable} written=${written} skipped=${skipped} failed=${failed}`);
  if (failed) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = {
  buildCandidateParties,
  candidateIdsFromDeal,
  hashesFromDeal,
  indexCandidates,
  mergeCandidateFacts,
  matchCandidateForDeal,
  parseArgs,
  proposedPatch,
  sourceUrlsFromDeal,
};
