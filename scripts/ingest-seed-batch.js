#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { createClaudeCliClient, createCodexCliClient } = require('../lib/llm-cli-client');
const { ingestOne, loadDotEnvLocal } = require('./ingest-local');
const { buildPartiesFact, buildValueUsdFact, mergeDealFacts } = require('../lib/deal-facts');

const PAGE_SIZE = 1000;
const DEFAULT_MODEL = 'gpt-5.5';
const DEFAULT_LOG = path.join(__dirname, '..', 'docs', 'ingest', 'seed-50-ingest-run.jsonl');

function parseArgs(argv) {
  const args = {
    manifest: null,
    backend: 'codex',
    model: DEFAULT_MODEL,
    limit: null,
    offset: 0,
    concurrency: 1,
    dryRun: false,
    continueOnError: false,
    log: DEFAULT_LOG,
    runId: null,
    candidateIds: new Set(),
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--manifest') args.manifest = argv[++i];
    else if (arg === '--backend') args.backend = argv[++i];
    else if (arg === '--model') args.model = argv[++i];
    else if (arg === '--limit') args.limit = Number(argv[++i]);
    else if (arg === '--offset') args.offset = Number(argv[++i]);
    else if (arg === '--concurrency') args.concurrency = Number(argv[++i]);
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--continue-on-error') args.continueOnError = true;
    else if (arg === '--log') args.log = argv[++i];
    else if (arg === '--run-id') args.runId = argv[++i];
    else if (arg === '--candidate-id') args.candidateIds.add(argv[++i]);
    else throw new Error(`Unknown arg: ${arg}`);
  }

  if (!args.manifest) throw new Error('Provide --manifest <path.json>');
  if (!['claude', 'codex'].includes(args.backend)) throw new Error('--backend must be claude or codex');
  if (args.limit != null && (!Number.isInteger(args.limit) || args.limit <= 0)) throw new Error('--limit must be a positive integer');
  if (!Number.isInteger(args.offset) || args.offset < 0) throw new Error('--offset must be a non-negative integer');
  if (!Number.isInteger(args.concurrency) || args.concurrency <= 0) throw new Error('--concurrency must be a positive integer');
  args.concurrency = Math.min(args.concurrency, 2);
  if (!args.runId) args.runId = `seed-50-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normaliseManifest(raw) {
  const rows = Array.isArray(raw) ? raw : raw.candidates;
  if (!Array.isArray(rows)) throw new Error('Manifest must be an array or an object with a candidates array');

  return rows.map((row, index) => {
    if (typeof row === 'string') {
      return {
        index,
        candidate_id: null,
        url: row,
        agreement_exhibit_url: row,
        priority_reasons: [],
      };
    }
    const url = row.agreement_exhibit_url || row.url;
    if (!url) throw new Error(`Manifest row ${index} is missing agreement_exhibit_url/url`);
    return {
      ...row,
      index,
      candidate_id: row.candidate_id || row.id || null,
      url,
      agreement_exhibit_url: url,
      deal_value_usd: row.deal_value_usd || row.value_usd || row.effective_value_usd || null,
      parties: row.parties || null,
      priority_reasons: Array.isArray(row.priority_reasons) ? row.priority_reasons : [],
    };
  });
}

function selectManifestItems(items, args) {
  let selected = [...items];
  if (args.candidateIds && args.candidateIds.size > 0) {
    selected = selected.filter((item) => item.candidate_id && args.candidateIds.has(item.candidate_id));
  }
  if (args.offset) selected = selected.slice(args.offset);
  if (args.limit != null) selected = selected.slice(0, args.limit);
  return selected;
}

function appendLog(logPath, event) {
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`);
}

function truncate(text, max = 900) {
  const value = String(text || '');
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
}

function createLlmClient(args) {
  return args.backend === 'codex'
    ? createCodexCliClient({ model: args.model })
    : createClaudeCliClient({ model: args.model });
}

async function fetchCandidate(sb, candidateId) {
  if (!candidateId) return null;
  const { data, error } = await sb
    .from('deal_candidates')
    .select('id,status,ingested_deal_id,agreement_exhibit_url')
    .eq('id', candidateId)
    .single();
  if (error) throw new Error(`Candidate fetch failed: ${error.message}`);
  return data;
}

async function updateCandidate(sb, candidateId, updates) {
  if (!candidateId) return null;
  const { data, error } = await sb
    .from('deal_candidates')
    .update(updates)
    .eq('id', candidateId)
    .select()
    .single();
  if (error) throw new Error(`Candidate update failed: ${error.message}`);
  return data;
}

async function findExistingDealBySourceUrl(sb, url) {
  const { data, error } = await sb.from('deals').select('id,acquirer,target,metadata');
  if (error) throw new Error(`Existing deal check failed: ${error.message}`);
  return (data || []).find((deal) => {
    const meta = deal && deal.metadata && typeof deal.metadata === 'object' ? deal.metadata : {};
    return String(meta.source_url || '').trim() === String(url || '').trim();
  }) || null;
}

async function fetchAllProvisions(sb, dealId) {
  const out = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await sb
      .from('provisions')
      .select('id,ai_metadata')
      .eq('deal_id', dealId)
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(`Provision fetch failed: ${error.message}`);
    out.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return out;
}

function seedMetadata(item, args) {
  return {
    extractedBy: args.backend,
    extractionModel: args.model,
    seedRunId: args.runId,
    seedCandidateId: item.candidate_id || null,
    seedDealKey: item.deal_key || null,
    seedPriorityReasons: item.priority_reasons || [],
    seedPriorityVerification: item.priority_verification || null,
    seedCandidateDealValueUsd: item.deal_value_usd || null,
  };
}

async function stampProvisionMetadata(sb, dealId, item, args) {
  const provisions = await fetchAllProvisions(sb, dealId);
  const seed = seedMetadata(item, args);
  for (const provision of provisions) {
    const aiMetadata = provision.ai_metadata && typeof provision.ai_metadata === 'object'
      ? provision.ai_metadata
      : {};
    const { error } = await sb
      .from('provisions')
      .update({ ai_metadata: { ...aiMetadata, ...seed } })
      .eq('id', provision.id);
    if (error) throw new Error(`Provision metadata update failed: ${error.message}`);
  }
  return provisions.length;
}

async function inspectPartialDealAfterError(sb, item, args, error) {
  const existing = await findExistingDealBySourceUrl(sb, item.url);
  if (!existing) return null;
  const provisions = await fetchAllProvisions(sb, existing.id);
  const partial = {
    deal_id: existing.id,
    title: `${existing.acquirer || '?'} / ${existing.target || '?'}`,
    provision_count: provisions.length,
  };
  appendLog(args.log, {
    event: 'candidate_partial_deal_after_error',
    run_id: args.runId,
    candidate_id: item.candidate_id,
    error: error.message,
    ...partial,
  });
  return partial;
}

async function stampDealMetadata(sb, dealId, item, args) {
  const { data, error } = await sb.from('deals').select('metadata,value_usd').eq('id', dealId).single();
  if (error) throw new Error(`Deal metadata fetch failed: ${error.message}`);
  const current = data && data.metadata && typeof data.metadata === 'object' ? data.metadata : {};
  const candidateValue = item.deal_value_usd || (item.priority_verification && item.priority_verification.value_usd) || null;
  const itemParties = item.parties && typeof item.parties === 'object' ? item.parties : {};
  const candidateParties = buildPartiesFact({
    acquirer: itemParties.contractual_acquirer || itemParties.acquirer || null,
    target: itemParties.contractual_target || itemParties.target || null,
    parent_entity: itemParties.acquirer || null,
    target_entity: itemParties.target || null,
    acquirer_display: itemParties.acquirer || null,
    target_display: itemParties.target || null,
  }, {
    source_url: item.url || item.agreement_exhibit_url || null,
    source_label: 'Seed manifest party metadata',
    method: 'candidate_metadata',
  });
  const seedIngest = {
    run_id: args.runId,
    candidate_id: item.candidate_id || null,
    deal_key: item.deal_key || null,
    priority_reasons: item.priority_reasons || [],
    priority_verification: item.priority_verification || null,
    candidate_deal_value_usd: candidateValue,
    ingested_by: args.backend,
    extraction_model: args.model,
    ingested_at: new Date().toISOString(),
  };
  const metadata = mergeDealFacts({ ...current, seed_ingest: seedIngest }, {
    value_usd: buildValueUsdFact(candidateValue, {
      source_url: item.url || item.agreement_exhibit_url || null,
      source_label: 'EDGAR candidate metadata',
      method: 'candidate_metadata',
    }),
    parties: candidateParties,
  });
  const updateRow = {
    metadata,
    ...(candidateValue && !data.value_usd ? { value_usd: candidateValue } : {}),
  };
  const { error: updateError } = await sb
    .from('deals')
    .update(updateRow)
    .eq('id', dealId);
  if (updateError) throw new Error(`Deal metadata update failed: ${updateError.message}`);
}

async function runOne(sb, client, item, args) {
  appendLog(args.log, {
    event: args.dryRun ? 'dry_run_candidate' : 'candidate_start',
    run_id: args.runId,
    candidate_id: item.candidate_id,
    url: item.url,
    priority_reasons: item.priority_reasons,
  });

  if (args.dryRun) return { status: 'dry-run', item };

  const candidate = await fetchCandidate(sb, item.candidate_id);
  if (candidate && candidate.ingested_deal_id) {
    appendLog(args.log, {
      event: 'candidate_already_marked_ingested',
      run_id: args.runId,
      candidate_id: item.candidate_id,
      deal_id: candidate.ingested_deal_id,
    });
    return { status: 'already-ingested', item, deal_id: candidate.ingested_deal_id };
  }

  const existing = await findExistingDealBySourceUrl(sb, item.url);
  if (existing) {
    await updateCandidate(sb, item.candidate_id, {
      status: 'ingested',
      ingested_deal_id: existing.id,
      skip_reason: null,
    });
    appendLog(args.log, {
      event: 'candidate_source_url_already_in_corpus',
      run_id: args.runId,
      candidate_id: item.candidate_id,
      deal_id: existing.id,
      title: `${existing.acquirer || '?'} / ${existing.target || '?'}`,
    });
    return { status: 'already-in-corpus', item, deal_id: existing.id };
  }

  await updateCandidate(sb, item.candidate_id, { status: 'queued', skip_reason: null });
  const itemWithCandidateFacts = {
    ...item,
    deal_value_usd: (candidate && candidate.deal_value_usd) || item.deal_value_usd || null,
    parties: item.parties || (candidate ? {
      acquirer: candidate.acquirer_name || null,
      target: candidate.target_name || null,
      filed_by: candidate.filed_by_party || null,
    } : null),
  };
  const result = await ingestOne(sb, client, item.url);
  await stampDealMetadata(sb, result.deal_id, itemWithCandidateFacts, args);
  const stampedProvisionCount = await stampProvisionMetadata(sb, result.deal_id, itemWithCandidateFacts, args);
  await updateCandidate(sb, item.candidate_id, {
    status: 'ingested',
    ingested_deal_id: result.deal_id,
    skip_reason: null,
  });

  appendLog(args.log, {
    event: 'candidate_ingested',
    run_id: args.runId,
    candidate_id: item.candidate_id,
    deal_id: result.deal_id,
    title: result.title,
    inserted: result.inserted,
    stamped_provisions: stampedProvisionCount,
    timing_ms: result.timing_ms,
  });

  return { status: 'ingested', item, result };
}

async function runQueue(sb, client, items, args) {
  let next = 0;
  let stopped = false;
  const results = [];

  async function worker() {
    for (;;) {
      if (stopped) return;
      const index = next++;
      if (index >= items.length) return;
      const item = items[index];
      try {
        results.push(await runOne(sb, client, item, args));
      } catch (error) {
        let partial = null;
        try {
          partial = await inspectPartialDealAfterError(sb, item, args, error);
        } catch (inspectError) {
          appendLog(args.log, {
            event: 'candidate_partial_deal_inspection_failed',
            run_id: args.runId,
            candidate_id: item.candidate_id,
            error: inspectError.message,
          });
        }
        appendLog(args.log, {
          event: 'candidate_error',
          run_id: args.runId,
          candidate_id: item.candidate_id,
          url: item.url,
          error: error.message,
        });
        try {
          const suffix = partial
            ? ` Partial deal ${partial.deal_id} has ${partial.provision_count} provisions.`
            : '';
          await updateCandidate(sb, item.candidate_id, {
            status: 'error',
            skip_reason: truncate(`${error.message}${suffix}`),
          });
        } catch (updateError) {
          appendLog(args.log, {
            event: 'candidate_error_status_update_failed',
            run_id: args.runId,
            candidate_id: item.candidate_id,
            error: updateError.message,
          });
        }
        results.push({ status: 'error', item, error });
        if (!args.continueOnError) {
          stopped = true;
          return;
        }
      }
    }
  }

  await Promise.all(Array.from({ length: args.concurrency }, () => worker()));
  return results;
}

async function main() {
  loadDotEnvLocal();
  const args = parseArgs(process.argv);
  const dbUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!dbUrl || !key) throw new Error('Supabase creds required in env or .env.local');

  const manifest = normaliseManifest(readJson(args.manifest));
  const items = selectManifestItems(manifest, args);
  if (items.length === 0) throw new Error('No manifest items selected');

  const sb = createClient(dbUrl, key);
  const client = createLlmClient(args);
  appendLog(args.log, {
    event: args.dryRun ? 'seed_batch_dry_run_start' : 'seed_batch_start',
    run_id: args.runId,
    manifest: args.manifest,
    backend: args.backend,
    model: args.model,
    selected_count: items.length,
    concurrency: args.concurrency,
  });

  console.log(`${args.dryRun ? 'Dry run' : 'Ingesting'} ${items.length} seed candidate(s), run ${args.runId}`);
  const results = await runQueue(sb, client, items, args);
  const errors = results.filter((result) => result.status === 'error');
  appendLog(args.log, {
    event: args.dryRun ? 'seed_batch_dry_run_complete' : 'seed_batch_complete',
    run_id: args.runId,
    total: results.length,
    errors: errors.length,
  });

  console.log(`Done: ${results.length} processed, ${errors.length} error(s). Log: ${args.log}`);
  if (errors.length > 0) process.exitCode = 1;
}

module.exports = {
  DEFAULT_LOG,
  DEFAULT_MODEL,
  createLlmClient,
  normaliseManifest,
  parseArgs,
  seedMetadata,
  selectManifestItems,
  truncate,
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
