#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const PAUL_WEISS_RE = /Paul\s*,\s*Weiss|Paul\s+Weiss|Paul\s*,\s*Weiss\s*,\s*Rifkind/i;
const MEGA_DEAL_USD = 10_000_000_000;
const DEFAULT_TARGET_COUNT = 32;
const DEFAULT_LIMIT = 200;
const VALID_STATUSES = new Set(['pending', 'queued', 'ingested', 'skipped', 'error', 'all']);
const DEFAULT_PRIORITY_FILE = path.join(__dirname, '..', 'docs', 'ingest', 'seed-50-priority-deals.json');

function findDotEnvLocal(start = path.join(__dirname, '..')) {
  let dir = start;
  for (;;) {
    const candidate = path.join(dir, '.env.local');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function loadDotEnvLocal(envPath = findDotEnvLocal()) {
  if (!envPath || !fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

function parseArgs(argv) {
  const args = {
    limit: DEFAULT_LIMIT,
    targetCount: DEFAULT_TARGET_COUNT,
    status: 'pending',
    dryRun: false,
    out: null,
    priorityFile: DEFAULT_PRIORITY_FILE,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--limit') args.limit = Number(argv[++i]);
    else if (arg === '--target-count') args.targetCount = Number(argv[++i]);
    else if (arg === '--status') args.status = argv[++i];
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--out') args.out = argv[++i];
    else if (arg === '--priority-file') args.priorityFile = argv[++i];
    else throw new Error(`Unknown arg: ${arg}`);
  }

  if (!Number.isInteger(args.limit) || args.limit <= 0) throw new Error('--limit must be a positive integer');
  if (!Number.isInteger(args.targetCount) || args.targetCount <= 0) throw new Error('--target-count must be a positive integer');
  if (!VALID_STATUSES.has(args.status)) throw new Error(`--status must be one of: ${Array.from(VALID_STATUSES).join(', ')}`);
  return args;
}

function readPriorityFile(priorityFile = DEFAULT_PRIORITY_FILE) {
  if (!priorityFile || !fs.existsSync(priorityFile)) return [];
  const raw = JSON.parse(fs.readFileSync(priorityFile, 'utf8'));
  if (!Array.isArray(raw)) throw new Error('--priority-file must contain a JSON array');
  return raw;
}

function priorityIndexes(rows) {
  const byCandidateId = new Map();
  const byUrl = new Map();
  for (const row of rows || []) {
    if (row.candidate_id) byCandidateId.set(String(row.candidate_id), row);
    if (row.agreement_exhibit_url) byUrl.set(String(row.agreement_exhibit_url).trim(), row);
  }
  return { byCandidateId, byUrl };
}

function priorityFor(candidate, indexes) {
  if (!indexes) return null;
  return indexes.byCandidateId.get(String(candidate.id))
    || indexes.byUrl.get(String(candidate.agreement_exhibit_url || '').trim())
    || null;
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/td>/gi, '\t')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function snippetAround(text, regex, radius = 140) {
  const match = regex.exec(text);
  if (!match) return null;
  const start = Math.max(0, match.index - radius);
  const end = Math.min(text.length, match.index + match[0].length + radius);
  const prefix = start > 0 ? '...' : '';
  const suffix = end < text.length ? '...' : '';
  return `${prefix}${text.slice(start, end).replace(/\s+/g, ' ').trim()}${suffix}`;
}

function nodeFetchText(url, headers) {
  return new Promise((resolve, reject) => {
    const client = String(url).startsWith('https') ? https : http;
    const req = client.get(url, { headers }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const next = new URL(res.headers.location, url).toString();
        return nodeFetchText(next, headers).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(45000, () => {
      req.destroy();
      reject(new Error(`Timeout fetching ${url}`));
    });
  });
}

async function fetchAgreementText(url, fetchImpl = globalThis.fetch) {
  const headers = {
    'User-Agent': process.env.SEC_USER_AGENT || 'PrecedentMachine seed selector bengoodchild@gmail.com',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7',
    'Accept-Encoding': 'identity',
  };

  if (fetchImpl) {
    const response = await fetchImpl(url, { headers });
    if (!response || !response.ok) {
      const status = response && response.status ? response.status : 'unknown';
      throw new Error(`HTTP ${status} fetching ${url}`);
    }
    return stripHtml(await response.text());
  }
  return stripHtml(await nodeFetchText(url, headers));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchCandidates(sb, status, limit) {
  let query = sb.from('deal_candidates')
    .select('id,filing_date,filed_by_party,target_name,acquirer_name,deal_value_usd,announced_at,agreement_exhibit_url,agreement_text_hash,status')
    .order('filing_date', { ascending: false })
    .limit(limit);

  if (status !== 'all') query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw new Error(error.message || 'Failed to fetch deal candidates');
  return data || [];
}

async function fetchExistingSourceUrls(sb) {
  const { data, error } = await sb.from('deals').select('id,metadata');
  if (error) throw new Error(error.message || 'Failed to fetch existing deals');
  return new Set((data || [])
    .map((deal) => deal && deal.metadata && deal.metadata.source_url)
    .map((url) => typeof url === 'string' ? url.trim() : url)
    .filter(Boolean));
}

function partyKey(candidate) {
  return [
    candidate.acquirer_name || candidate.filed_by_party || '',
    candidate.target_name || '',
  ].join('|').toLowerCase();
}

function dealKey(item) {
  const priority = item.priority || {};
  return priority.deal_key
    || partyKey(item.candidate)
    || item.candidate.agreement_text_hash
    || item.candidate.agreement_exhibit_url;
}

function effectiveValueUsd(item) {
  const verified = Number(item.priority && item.priority.verified_value_usd);
  if (Number.isFinite(verified) && verified > 0) return verified;
  const candidateValue = Number(item.candidate && item.candidate.deal_value_usd);
  return Number.isFinite(candidateValue) ? candidateValue : 0;
}

function reasonsFor(item) {
  const candidate = item.candidate;
  const reasons = [];
  if (item.paul_weiss_found) reasons.push('Paul Weiss named in agreement text');
  if (effectiveValueUsd(item) >= MEGA_DEAL_USD) reasons.push('Deal value at or above $10bn');
  if (item.priority && item.priority.focus_note) reasons.push(item.priority.focus_note);
  if (reasons.length === 0) reasons.push('Recency/diversity fallback');
  return reasons;
}

function priorityBucket(item) {
  if (item.paul_weiss_found) return 0;
  if (effectiveValueUsd(item) >= MEGA_DEAL_USD) return 1;
  return 2;
}

function filingTime(candidate) {
  const time = Date.parse(candidate.filing_date || candidate.announced_at || '');
  return Number.isFinite(time) ? time : 0;
}

function sortByPriority(a, b) {
  return priorityBucket(a) - priorityBucket(b)
    || filingTime(b.candidate) - filingTime(a.candidate)
    || String(a.candidate.id).localeCompare(String(b.candidate.id));
}

function selectWithDiversity(items, targetCount) {
  const sorted = [...items].sort(sortByPriority);
  const selected = [];
  const seenDealKeys = new Set();

  for (const bucket of [0, 1, 2]) {
    const bucketItems = sorted.filter((item) => priorityBucket(item) === bucket);
    const seenInBucket = new Set();

    for (const item of bucketItems) {
      const key = partyKey(item.candidate);
      const globalKey = dealKey(item);
      if (selected.length >= targetCount) return selected;
      if (globalKey && seenDealKeys.has(globalKey)) continue;
      if (key && seenInBucket.has(key)) continue;
      selected.push(item);
      seenInBucket.add(key);
      if (globalKey) seenDealKeys.add(globalKey);
    }

    for (const item of bucketItems) {
      const globalKey = dealKey(item);
      if (selected.length >= targetCount) return selected;
      if (globalKey && seenDealKeys.has(globalKey)) continue;
      if (!selected.includes(item)) {
        selected.push(item);
        if (globalKey) seenDealKeys.add(globalKey);
      }
    }
  }

  return selected;
}

function toManifestCandidate(item) {
  const candidate = item.candidate;
  return {
    candidate_id: candidate.id,
    filing_date: candidate.filing_date || null,
    parties: {
      acquirer: candidate.acquirer_name || null,
      target: candidate.target_name || null,
      filed_by: candidate.filed_by_party || null,
    },
    value_usd: candidate.deal_value_usd == null ? null : Number(candidate.deal_value_usd),
    effective_value_usd: effectiveValueUsd(item) || null,
    url: candidate.agreement_exhibit_url,
    agreement_exhibit_url: candidate.agreement_exhibit_url,
    agreement_text_hash: candidate.agreement_text_hash || null,
    deal_key: dealKey(item) || null,
    priority_reasons: reasonsFor(item),
    paul_weiss_evidence_snippet: item.paul_weiss_evidence_snippet,
    priority_verification: item.priority && item.priority.verified_value_usd ? {
      value_usd: Number(item.priority.verified_value_usd),
      value_metric: item.priority.value_metric || null,
      source_label: item.priority.source_label || null,
      source_url: item.priority.source_url || null,
      note: item.priority.verification_note || null,
    } : null,
  };
}

async function selectSeedDeals(options) {
  const {
    supabase,
    status = 'pending',
    limit = DEFAULT_LIMIT,
    targetCount = DEFAULT_TARGET_COUNT,
    fetchImpl = globalThis.fetch,
    delayMs = 500,
    now = () => new Date(),
    dryRun = false,
    priorityRows = [],
  } = options || {};

  if (!supabase) throw new Error('Supabase client is required');
  const indexes = priorityIndexes(priorityRows);

  const [candidates, existingSourceUrls] = await Promise.all([
    fetchCandidates(supabase, status, limit),
    fetchExistingSourceUrls(supabase),
  ]);

  const unrepresented = candidates.filter((candidate) => {
    const priority = priorityFor(candidate, indexes);
    if (priority && priority.exclude) return false;
    const url = candidate.agreement_exhibit_url && candidate.agreement_exhibit_url.trim();
    return url && !existingSourceUrls.has(url);
  });

  const scored = [];
  for (let i = 0; i < unrepresented.length; i++) {
    const candidate = unrepresented[i];
    let text = '';
    let evidence = null;
    try {
      text = await fetchAgreementText(candidate.agreement_exhibit_url, fetchImpl);
      evidence = snippetAround(text, PAUL_WEISS_RE);
    } catch (error) {
      evidence = null;
    }
    scored.push({
      candidate,
      priority: priorityFor(candidate, indexes),
      paul_weiss_found: Boolean(evidence),
      paul_weiss_evidence_snippet: evidence,
    });
    if (delayMs > 0 && i < unrepresented.length - 1) await sleep(delayMs);
  }

  const selected = selectWithDiversity(scored, targetCount);
  return {
    generated_at: now().toISOString(),
    dry_run: Boolean(dryRun),
    status,
    limit,
    target_count: targetCount,
    scanned_count: candidates.length,
    duplicate_excluded_count: candidates.length - unrepresented.length,
    priority_file_count: priorityRows.length,
    selected_count: selected.length,
    candidates: selected.map(toManifestCandidate),
  };
}

async function main() {
  loadDotEnvLocal();
  const args = parseArgs(process.argv);
  const dbUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!dbUrl || !key) throw new Error('Supabase creds required in env or .env.local');

  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(dbUrl, key);
  const priorityRows = readPriorityFile(args.priorityFile);
  const manifest = await selectSeedDeals({
    supabase,
    status: args.status,
    limit: args.limit,
    targetCount: args.targetCount,
    dryRun: args.dryRun,
    priorityRows,
  });
  const json = `${JSON.stringify(manifest, null, 2)}\n`;

  if (args.out) fs.writeFileSync(args.out, json);
  else process.stdout.write(json);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  DEFAULT_LIMIT,
  DEFAULT_TARGET_COUNT,
  MEGA_DEAL_USD,
  PAUL_WEISS_RE,
  DEFAULT_PRIORITY_FILE,
  fetchAgreementText,
  findDotEnvLocal,
  loadDotEnvLocal,
  parseArgs,
  priorityIndexes,
  readPriorityFile,
  reasonsFor,
  selectSeedDeals,
  selectWithDiversity,
  stripHtml,
};
