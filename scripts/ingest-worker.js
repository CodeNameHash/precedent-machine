#!/usr/bin/env node

const os = require('os');
const { createClient } = require('@supabase/supabase-js');
const { createClaudeCliClient, createCodexCliClient } = require('../lib/llm-cli-client');
const { prepareDealForIngest, loadDotEnvLocal } = require('./ingest-local');
const { qaOneDeal } = require('./ingest-qa');
const { runExtractTypePhase, markExtractFailed } = require('../lib/parser-v2/run-extract');
const { backfillSectionLeftovers } = require('../lib/parser-v2/extract');
const { cleanText } = require('../lib/parser-v2/structural');
const { sectionsForExtractFromSnapshot } = require('../lib/parser-v2/snapshot');
const { storeProvisionsForType } = require('../lib/parser-v2/store');
const { validateProvisions } = require('../lib/parser-v2/validate');
const { buildPartiesFact, buildValueUsdFact, mergeDealFacts } = require('../lib/deal-facts');

const PAGE_SIZE = 1000;
const DEFAULT_MODEL = 'gpt-5.5';
const CLAIMABLE_KINDS = new Set(['deal-prepare', 'family-extract', 'deal-qa', 'finalize-candidate']);

function parsePositiveInt(value, fallback) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return fallback;
  return n;
}

function parseArgs(argv) {
  const args = {
    backend: 'codex',
    model: DEFAULT_MODEL,
    workerId: `${os.hostname()}-${process.pid}`,
    runId: null,
    kinds: null,
    once: false,
    concurrency: 1,
    pollMs: 5000,
    leaseSeconds: 60 * 60,
    maxJobs: null,
    stopOnError: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--backend') args.backend = argv[++i];
    else if (arg === '--model') args.model = argv[++i];
    else if (arg === '--worker-id') args.workerId = argv[++i];
    else if (arg === '--run-id') args.runId = argv[++i];
    else if (arg === '--kinds') args.kinds = String(argv[++i]).split(',').map((s) => s.trim()).filter(Boolean);
    else if (arg === '--once') args.once = true;
    else if (arg === '--concurrency') args.concurrency = parsePositiveInt(argv[++i], 1);
    else if (arg === '--poll-ms') args.pollMs = parsePositiveInt(argv[++i], 5000);
    else if (arg === '--lease-seconds') args.leaseSeconds = parsePositiveInt(argv[++i], 60 * 60);
    else if (arg === '--max-jobs') args.maxJobs = parsePositiveInt(argv[++i], null);
    else if (arg === '--stop-on-error') args.stopOnError = true;
    else throw new Error(`Unknown arg: ${arg}`);
  }

  if (!['claude', 'codex'].includes(args.backend)) throw new Error('--backend must be claude or codex');
  if (args.kinds) {
    for (const kind of args.kinds) {
      if (!CLAIMABLE_KINDS.has(kind)) throw new Error(`Unknown job kind "${kind}"`);
    }
  }
  args.concurrency = Math.min(args.concurrency, 8);
  return args;
}

function serviceSupabase() {
  loadDotEnvLocal();
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service credentials required in env or .env.local');
  return createClient(url, key);
}

function createLlmClient(args) {
  return args.backend === 'codex'
    ? createCodexCliClient({ model: args.model })
    : createClaudeCliClient({ model: args.model });
}

function truncate(text, max = 1200) {
  const value = String(text || '');
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
}

function jobUrl(job) {
  const payload = job.payload && typeof job.payload === 'object' ? job.payload : {};
  const candidate = payload.candidate && typeof payload.candidate === 'object' ? payload.candidate : {};
  return payload.url || candidate.agreement_exhibit_url || candidate.url || null;
}

function seedMetadata(job, args) {
  const payload = job.payload && typeof job.payload === 'object' ? job.payload : {};
  const candidate = payload.candidate && typeof payload.candidate === 'object' ? payload.candidate : {};
  const verification = payload.priority_verification && typeof payload.priority_verification === 'object'
    ? payload.priority_verification
    : {};
  return {
    run_id: job.run_id,
    candidate_id: job.candidate_id || payload.candidate_id || null,
    deal_key: payload.deal_key || null,
    priority_reasons: payload.priority_reasons || [],
    priority_verification: payload.priority_verification || null,
    candidate_deal_value_usd: payload.deal_value_usd || candidate.deal_value_usd || verification.value_usd || null,
    ingested_by: args.backend,
    extraction_model: args.model,
  };
}

async function insertEvent(sb, job, event, message, data = {}, level = 'info') {
  const row = {
    run_id: job.run_id,
    job_id: job.id,
    event,
    level,
    message,
    data,
  };
  const { error } = await sb.from('ingest_job_events').insert(row);
  if (error) console.warn(`[worker] event insert failed: ${error.message}`);
}

async function insertArtifact(sb, job, kind, label, json, text = null) {
  const { error } = await sb.from('ingest_job_artifacts').insert({
    run_id: job.run_id,
    job_id: job.id,
    kind,
    label,
    json,
    text,
  });
  if (error) console.warn(`[worker] artifact insert failed: ${error.message}`);
}

async function refreshRunStatus(sb, runId) {
  const { data: jobs, error } = await sb
    .from('ingest_jobs')
    .select('status')
    .eq('run_id', runId);
  if (error) {
    console.warn(`[worker] run status refresh failed: ${error.message}`);
    return;
  }
  const counts = {};
  for (const job of jobs || []) counts[job.status] = (counts[job.status] || 0) + 1;
  const total = (jobs || []).length;
  let status = 'queued';
  if (counts.failed) status = 'failed';
  else if (counts.needs_review) status = 'needs_review';
  else if (counts.running) status = 'running';
  else if (total > 0 && counts.succeeded === total) status = 'succeeded';
  const active = (counts.pending || 0) + (counts.running || 0);
  const updates = {
    status,
    summary: { job_status_counts: counts },
    ...(status === 'running' ? { started_at: new Date().toISOString() } : {}),
    ...((status === 'succeeded' || (active === 0 && (status === 'failed' || status === 'needs_review')))
      ? { completed_at: new Date().toISOString() }
      : {}),
  };
  const { error: updateError } = await sb.from('ingest_runs').update(updates).eq('id', runId);
  if (updateError) console.warn(`[worker] run update failed: ${updateError.message}`);
}

async function completeJob(sb, job, result, status = 'succeeded') {
  const { data, error } = await sb.from('ingest_jobs')
    .update({
      status,
      result: result || {},
      locked_by: null,
      locked_until: null,
      error_message: null,
      completed_at: new Date().toISOString(),
    })
    .eq('id', job.id)
    .select()
    .single();
  if (error) throw new Error(`Job completion failed: ${error.message}`);
  await insertEvent(sb, job, status === 'needs_review' ? 'job_needs_review' : 'job_succeeded', null, result || {}, status === 'needs_review' ? 'warn' : 'info');
  await refreshRunStatus(sb, job.run_id);
  return data;
}

async function failJob(sb, job, error) {
  const retryable = Number(job.attempts || 0) < Number(job.max_attempts || 1);
  const nextStatus = retryable ? 'pending' : 'failed';
  const message = truncate(error && error.message ? error.message : error);
  const { data, error: updateError } = await sb.from('ingest_jobs')
    .update({
      status: nextStatus,
      locked_by: null,
      locked_until: null,
      error_message: message,
      completed_at: retryable ? null : new Date().toISOString(),
    })
    .eq('id', job.id)
    .select()
    .single();
  if (updateError) throw new Error(`Job failure update failed: ${updateError.message}`);
  await insertEvent(sb, job, retryable ? 'job_retry_pending' : 'job_failed', message, {
    attempts: job.attempts,
    max_attempts: job.max_attempts,
  }, 'error');
  await refreshRunStatus(sb, job.run_id);
  return data;
}

async function fetchCandidate(sb, candidateId) {
  if (!candidateId) return null;
  const { data, error } = await sb
    .from('deal_candidates')
    .select('*')
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
  const sourceUrl = String(url || '').trim();
  if (!sourceUrl) return null;

  const filtered = await sb
    .from('deals')
    .select('id,acquirer,target,metadata')
    .eq('metadata->>source_url', sourceUrl)
    .limit(1);
  if (!filtered.error) return (filtered.data && filtered.data[0]) || null;

  const { data, error } = await sb.from('deals').select('id,acquirer,target,metadata');
  if (error) throw new Error(`Existing deal check failed: ${error.message}`);
  return (data || []).find((deal) => {
    const meta = deal && deal.metadata && typeof deal.metadata === 'object' ? deal.metadata : {};
    return String(meta.source_url || '').trim() === sourceUrl;
  }) || null;
}

function isStagingDeal(deal) {
  const meta = deal && deal.metadata && typeof deal.metadata === 'object' ? deal.metadata : {};
  return meta.ingest_status === 'staging';
}

async function propagateDealId(sb, job, dealId) {
  if (!dealId) return;
  let query = sb.from('ingest_jobs')
    .update({ deal_id: dealId })
    .eq('run_id', job.run_id)
    .is('deal_id', null);
  if (job.candidate_id) query = query.eq('candidate_id', job.candidate_id);
  else return;
  const { error } = await query;
  if (error) throw new Error(`Deal id propagation failed: ${error.message}`);
}

async function markDownstreamSucceeded(sb, job, result) {
  if (!job.candidate_id) return;
  const { error } = await sb.from('ingest_jobs')
    .update({
      status: 'succeeded',
      result,
      locked_by: null,
      locked_until: null,
      error_message: null,
      completed_at: new Date().toISOString(),
    })
    .eq('run_id', job.run_id)
    .eq('candidate_id', job.candidate_id)
    .neq('id', job.id)
    .neq('status', 'succeeded');
  if (error) throw new Error(`Downstream skip failed: ${error.message}`);
}

async function resolveDealId(sb, job) {
  if (job.deal_id) return job.deal_id;
  const url = jobUrl(job);
  let query = sb.from('ingest_jobs')
    .select('id,candidate_id,deal_id,result,payload')
    .eq('run_id', job.run_id)
    .eq('kind', 'deal-prepare')
    .eq('status', 'succeeded');
  if (job.candidate_id) query = query.eq('candidate_id', job.candidate_id);
  const { data, error } = await query;
  if (error) throw new Error(`Prepare job lookup failed: ${error.message}`);
  const match = (data || []).find((row) => {
    if (job.candidate_id && row.candidate_id === job.candidate_id) return true;
    const payloadUrl = jobUrl(row);
    return url && payloadUrl === url;
  });
  const dealId = match && (match.deal_id || (match.result && match.result.deal_id));
  if (!dealId) throw new Error(`No prepared deal found for ${job.id}`);
  const { error: updateError } = await sb.from('ingest_jobs').update({ deal_id: dealId }).eq('id', job.id);
  if (updateError) throw new Error(`Job deal id update failed: ${updateError.message}`);
  return dealId;
}

async function fetchDeal(sb, dealId) {
  const { data, error } = await sb
    .from('deals')
    .select('id, acquirer, target, value_usd, metadata, announce_date')
    .eq('id', dealId)
    .single();
  if (error) throw new Error(`Deal fetch failed: ${error.message}`);
  return data;
}

async function fetchAllProvisions(sb, dealId) {
  const out = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await sb
      .from('provisions')
      .select('id, ai_metadata')
      .eq('deal_id', dealId)
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(`Provision fetch failed: ${error.message}`);
    out.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return out;
}

async function fetchProvisionRowsForBackfill(sb, dealId) {
  const out = [];
  let offset = 0;
  const baseSelect = 'id, type, category, full_text, ai_favorability, ai_metadata';
  let includeRegionId = true;
  for (;;) {
    let result = await sb
      .from('provisions')
      .select(includeRegionId ? `${baseSelect}, region_id` : baseSelect)
      .eq('deal_id', dealId)
      .range(offset, offset + PAGE_SIZE - 1);
    if (result.error && includeRegionId && /region_id|schema cache|does not exist|Could not find/i.test(result.error.message || '')) {
      includeRegionId = false;
      result = await sb
        .from('provisions')
        .select(baseSelect)
        .eq('deal_id', dealId)
        .range(offset, offset + PAGE_SIZE - 1);
    }
    const { data, error } = result;
    if (error) throw new Error(`Provision backfill fetch failed: ${error.message}`);
    out.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return out.filter((row) => !['OTHER', 'SECTION-LEFTOVER'].includes(row && row.type));
}

function dbProvisionToParserProvision(row) {
  const meta = row && row.ai_metadata && typeof row.ai_metadata === 'object' ? row.ai_metadata : {};
  const features = meta.features && typeof meta.features === 'object' ? meta.features : {};
  const startChar = typeof meta.startChar === 'number'
    ? meta.startChar
    : (typeof meta.start_char === 'number' ? meta.start_char : null);
  const regionId = row.region_id || meta.region_id || meta.regionId || features.region_id || features.regionId || null;
  const nextFeatures = regionId && !features.regionId ? { ...features, regionId } : features;
  return {
    type: row.type,
    code: meta.code || features.canonicalCode || null,
    category: row.category || 'Unclassified',
    text: row.full_text || '',
    full_text: row.full_text || '',
    startChar,
    regionId,
    region_id: regionId,
    favorability: row.ai_favorability || 'neutral',
    features: nextFeatures,
    relatedDefinitions: Array.isArray(meta.relatedDefinitions) ? meta.relatedDefinitions : [],
    isNewCode: Boolean(meta.isNewCode),
    proposedCode: meta.proposedCode || null,
    proposedLabel: meta.proposedLabel || null,
  };
}

async function refreshCoverageBackfillsForDeal(sb, deal) {
  const metadata = deal && deal.metadata && typeof deal.metadata === 'object' ? deal.metadata : {};
  const classified = Array.isArray(metadata.classified_sections) ? metadata.classified_sections : [];
  const fullText = cleanText(metadata.full_text || '');
  if (!deal || !deal.id || !fullText || classified.length === 0) {
    return { skipped: true, reason: 'missing-full-text-or-classified-sections' };
  }

  const sections = sectionsForExtractFromSnapshot(classified);
  const typedProvisions = (await fetchProvisionRowsForBackfill(sb, deal.id))
    .map(dbProvisionToParserProvision)
    .filter((provision) => provision.text);

  backfillSectionLeftovers(sections, typedProvisions);
  const validation = validateProvisions(typedProvisions, fullText, sections);
  const backfills = ((validation && validation.provisions) || typedProvisions)
    .filter((provision) =>
      provision &&
      provision.backfilled === true &&
      ['OTHER', 'SECTION-LEFTOVER'].includes(provision.type)
    );

  const storeResult = await storeProvisionsForType(deal.id, 'OTHER', backfills, sb);
  return {
    skipped: false,
    sections_checked: sections.length,
    typed_provisions: typedProvisions.filter((p) => !['OTHER', 'SECTION-LEFTOVER'].includes(p.type)).length,
    backfills: backfills.length,
    inserted: storeResult.insertedCount || 0,
    deleted: storeResult.deletedCount || 0,
    errors: storeResult.errors || null,
  };
}

async function stampProvisionMetadata(sb, dealId, seed) {
  const provisions = await fetchAllProvisions(sb, dealId);
  for (const provision of provisions) {
    const current = provision.ai_metadata && typeof provision.ai_metadata === 'object'
      ? provision.ai_metadata
      : {};
    const { error } = await sb
      .from('provisions')
      .update({ ai_metadata: { ...current, seed_ingest: seed } })
      .eq('id', provision.id);
    if (error) throw new Error(`Provision metadata update failed: ${error.message}`);
  }
  return provisions.length;
}

async function handlePrepare(sb, client, job, args) {
  const url = jobUrl(job);
  if (!url) throw new Error('Prepare job is missing a URL');

  const candidate = await fetchCandidate(sb, job.candidate_id);
  if (candidate && candidate.ingested_deal_id) {
    const result = { skipped: true, reason: 'candidate-already-ingested', deal_id: candidate.ingested_deal_id };
    await propagateDealId(sb, job, candidate.ingested_deal_id);
    await markDownstreamSucceeded(sb, job, result);
    return result;
  }

  const existing = await findExistingDealBySourceUrl(sb, url);
  if (existing && !isStagingDeal(existing)) {
    await updateCandidate(sb, job.candidate_id, {
      status: 'ingested',
      ingested_deal_id: existing.id,
      skip_reason: null,
      last_error: null,
    });
    const result = { skipped: true, reason: 'source-url-already-in-corpus', deal_id: existing.id };
    await propagateDealId(sb, job, existing.id);
    await markDownstreamSucceeded(sb, job, result);
    return result;
  }

  if (existing && isStagingDeal(existing)) {
    const result = {
      resumed: true,
      deal_id: existing.id,
      title: `${existing.acquirer || '?'} / ${existing.target || '?'}`,
    };
    await updateCandidate(sb, job.candidate_id, { status: 'queued', skip_reason: null, last_error: null });
    await propagateDealId(sb, job, existing.id);
    return result;
  }

  await updateCandidate(sb, job.candidate_id, { status: 'queued', skip_reason: null, last_error: null });
  const result = await prepareDealForIngest(sb, client, url, { seed_ingest: seedMetadata(job, args) });
  await propagateDealId(sb, job, result.deal_id);
  if (result && result.skipped) {
    await updateCandidate(sb, job.candidate_id, {
      status: 'ingested',
      ingested_deal_id: result.deal_id,
      skip_reason: result.reason || null,
      last_error: null,
    });
    await markDownstreamSucceeded(sb, job, result);
  }
  return result;
}

async function handleFamily(sb, client, job) {
  const dealId = await resolveDealId(sb, job);
  const type = job.family || (job.payload && job.payload.family);
  if (!type) throw new Error('Family job is missing family/type');
  try {
    const result = await runExtractTypePhase({ dealId, type, sb, client, dryRun: false });
    return { deal_id: dealId, ...result };
  } catch (error) {
    await markExtractFailed(sb, dealId, type, error.message);
    throw error;
  }
}

async function handleQa(sb, job) {
  const dealId = await resolveDealId(sb, job);
  const deal = await fetchDeal(sb, dealId);
  const coverageBackfill = await refreshCoverageBackfillsForDeal(sb, deal);
  const { ok, result: qaResult } = await qaOneDeal(sb, deal, null);
  const result = { deal_id: dealId, ok, coverage_backfill: coverageBackfill, qa: qaResult };
  await insertArtifact(sb, job, 'qa-result', ok ? 'QA passed' : 'QA needs review', result);
  if (!ok) {
    await updateCandidate(sb, job.candidate_id, {
      status: 'needs_review',
      review_notes: 'Ingest QA failed. Review staging deal before finalising.',
      last_error: null,
    });
  }
  return { result, status: ok ? 'succeeded' : 'needs_review' };
}

async function handleFinalize(sb, job, args) {
  const dealId = await resolveDealId(sb, job);
  const deal = await fetchDeal(sb, dealId);
  const candidate = await fetchCandidate(sb, job.candidate_id);
  const current = deal.metadata && typeof deal.metadata === 'object' ? deal.metadata : {};
  const seed = {
    ...(current.seed_ingest || {}),
    ...seedMetadata(job, args),
    ingested_at: new Date().toISOString(),
  };
  const candidateValue = (candidate && candidate.deal_value_usd) || seed.candidate_deal_value_usd || null;
  const candidateParties = candidate ? buildPartiesFact({
    acquirer: deal.acquirer || candidate.acquirer_name || null,
    target: deal.target || candidate.target_name || null,
    parent_entity: candidate.acquirer_name || null,
    target_entity: candidate.target_name || null,
    acquirer_display: candidate.acquirer_name || null,
    target_display: candidate.target_name || null,
  }, {
    source_url: candidate.agreement_exhibit_url || jobUrl(job),
    source_label: 'EDGAR candidate metadata',
    method: 'candidate_metadata',
  }) : null;
  const metadata = mergeDealFacts({
    ...current,
    seed_ingest: seed,
    ingest_status: 'clean',
    ingested_at: new Date().toISOString(),
  }, {
    value_usd: buildValueUsdFact(candidateValue, {
      source_url: (candidate && candidate.agreement_exhibit_url) || jobUrl(job),
      source_label: 'EDGAR candidate metadata',
      method: 'candidate_metadata',
    }),
    parties: candidateParties,
  });
  const updateRow = {
    metadata,
    ...(candidateValue && !deal.value_usd ? { value_usd: candidateValue } : {}),
  };
  const { error } = await sb.from('deals').update(updateRow).eq('id', dealId);
  if (error) throw new Error(`Deal finalise failed: ${error.message}`);
  const stamped = await stampProvisionMetadata(sb, dealId, seed);
  await updateCandidate(sb, job.candidate_id, {
    status: 'ingested',
    ingested_deal_id: dealId,
    skip_reason: null,
    review_notes: null,
    last_error: null,
  });
  return { deal_id: dealId, stamped_provisions: stamped };
}

async function runJob(sb, client, job, args) {
  await insertEvent(sb, job, 'job_started', `${job.kind} started`, {
    worker_id: args.workerId,
    attempt: job.attempts,
  });
  await refreshRunStatus(sb, job.run_id);

  if (job.kind === 'deal-prepare') return handlePrepare(sb, client, job, args);
  if (job.kind === 'family-extract') return handleFamily(sb, client, job, args);
  if (job.kind === 'deal-qa') return handleQa(sb, job, args);
  if (job.kind === 'finalize-candidate') return handleFinalize(sb, job, args);
  throw new Error(`Unsupported job kind ${job.kind}`);
}

async function claimJob(sb, args) {
  const { data, error } = await sb.rpc('claim_ingest_jobs', {
    p_worker_id: args.workerId,
    p_kinds: args.kinds,
    p_limit: 1,
    p_lease_seconds: args.leaseSeconds,
    p_run_id: args.runId,
  });
  if (error) throw new Error(`Job claim failed: ${error.message}`);
  const jobs = Array.isArray(data) ? data : [];
  return jobs[0] || null;
}

async function hasRunningJobs(sb, args) {
  if (!args.runId) return false;
  let query = sb.from('ingest_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('run_id', args.runId)
    .eq('status', 'running');
  if (args.kinds) query = query.in('kind', args.kinds);
  const { count, error } = await query;
  if (error) throw new Error(`Running job check failed: ${error.message}`);
  return Number(count || 0) > 0;
}

async function workerLoop(sb, client, args, shared) {
  for (;;) {
    if (shared.stopped) return;
    if (args.maxJobs != null && shared.processed >= args.maxJobs) return;

    const job = await claimJob(sb, args);
    if (!job) {
      if (args.once && !(await hasRunningJobs(sb, args))) return;
      await new Promise((resolve) => setTimeout(resolve, args.pollMs));
      continue;
    }

    try {
      const output = await runJob(sb, client, job, args);
      const status = output && output.status ? output.status : 'succeeded';
      const result = output && output.result ? output.result : output;
      await completeJob(sb, job, result, status);
      shared.processed += 1;
      console.log(`${status}: ${job.kind} ${job.id}`);
    } catch (error) {
      await failJob(sb, job, error);
      if (job.candidate_id) {
        try {
          await updateCandidate(sb, job.candidate_id, {
            status: 'error',
            last_error: truncate(error.message),
          });
        } catch (candidateError) {
          console.warn(`[worker] candidate error update failed: ${candidateError.message}`);
        }
      }
      shared.processed += 1;
      console.log(`failed: ${job.kind} ${job.id}: ${error.message}`);
      if (args.stopOnError) {
        shared.stopped = true;
        return;
      }
    }
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const sb = serviceSupabase();
  const client = createLlmClient(args);
  const shared = { processed: 0, stopped: false };

  console.log(`Worker ${args.workerId}: backend=${args.backend} model=${args.model} concurrency=${args.concurrency}`);
  await Promise.all(Array.from({ length: args.concurrency }, () => workerLoop(sb, client, args, shared)));
  console.log(`Worker ${args.workerId}: processed ${shared.processed} job(s)`);
}

module.exports = {
  CLAIMABLE_KINDS,
  createLlmClient,
  dbProvisionToParserProvision,
  handleFamily,
  handleFinalize,
  handlePrepare,
  handleQa,
  hasRunningJobs,
  findExistingDealBySourceUrl,
  jobUrl,
  parseArgs,
  refreshCoverageBackfillsForDeal,
  resolveDealId,
  seedMetadata,
  serviceSupabase,
  truncate,
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
