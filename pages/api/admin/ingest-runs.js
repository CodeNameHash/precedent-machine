import { getServiceSupabase } from '../../../lib/supabase';

const SAFE_ID_RE = /^[A-Za-z0-9_.:-]{1,240}$/;
const RETRY_BODY_KEYS = new Set(['action', 'job_id']);

function cleanId(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return SAFE_ID_RE.test(trimmed) ? trimmed : null;
}

function tableUnavailable(error) {
  if (!error) return null;
  const message = error.message || '';
  if (error.code === '42P01' || message.includes('does not exist') || message.includes('Could not find the table')) {
    return {
      code: 'INGEST_TABLES_UNAVAILABLE',
      message: 'Ingest queue tables are not available in this database yet.',
      detail: message,
    };
  }
  return null;
}

function fail(res, status, error, detail) {
  return res.status(status).json({ error, ...(detail ? { detail } : {}) });
}

function countJobs(jobs) {
  return (jobs || []).reduce((counts, job) => {
    const status = job.status || 'unknown';
    counts[status] = (counts[status] || 0) + 1;
    counts.total = (counts.total || 0) + 1;
    return counts;
  }, { total: 0 });
}

function eventMessage(event) {
  if (!event) return null;
  return event.message || event.event || event.level || null;
}

function latestEventForRun(events, runId) {
  return (events || []).find((event) => event.run_id === runId) || null;
}

async function getRunDetail(res, sb, runId) {
  const { data: run, error: runError } = await sb
    .from('ingest_runs')
    .select('*')
    .eq('id', runId)
    .single();

  const unavailable = tableUnavailable(runError);
  if (unavailable) return res.status(200).json({ runs: [], unavailable });
  if (runError) return fail(res, runError.code === 'PGRST116' ? 404 : 500, runError.message);

  const { data: jobs, error: jobsError } = await sb
    .from('ingest_jobs')
    .select('*')
    .eq('run_id', runId)
    .order('created_at', { ascending: true });
  const jobsUnavailable = tableUnavailable(jobsError);
  if (jobsUnavailable) return res.status(200).json({ run, jobs: [], events: [], artifacts: [], unavailable: jobsUnavailable });
  if (jobsError) return fail(res, 500, jobsError.message);

  const { data: events, error: eventsError } = await sb
    .from('ingest_job_events')
    .select('*')
    .eq('run_id', runId)
    .order('created_at', { ascending: false })
    .limit(200);
  const eventsUnavailable = tableUnavailable(eventsError);
  if (eventsError && !eventsUnavailable) return fail(res, 500, eventsError.message);

  const { data: artifacts, error: artifactsError } = await sb
    .from('ingest_job_artifacts')
    .select('*')
    .eq('run_id', runId)
    .order('created_at', { ascending: false })
    .limit(100);
  const artifactsUnavailable = tableUnavailable(artifactsError);
  if (artifactsError && !artifactsUnavailable) return fail(res, 500, artifactsError.message);

  const safeEvents = eventsUnavailable ? [] : (events || []);
  return res.status(200).json({
    run: {
      ...run,
      job_counts: countJobs(jobs),
      latest_event_at: safeEvents[0]?.created_at || null,
      latest_event_message: eventMessage(safeEvents[0]),
    },
    jobs: jobs || [],
    events: safeEvents,
    artifacts: artifactsUnavailable ? [] : (artifacts || []),
    ...(eventsUnavailable ? { events_unavailable: eventsUnavailable } : {}),
    ...(artifactsUnavailable ? { artifacts_unavailable: artifactsUnavailable } : {}),
  });
}

async function getRuns(req, res, sb) {
  const runId = req.query.run_id ? cleanId(req.query.run_id) : null;
  if (req.query.run_id && !runId) return fail(res, 400, 'Invalid run_id');
  if (runId) return getRunDetail(res, sb, runId);

  const { data: runs, error: runsError } = await sb
    .from('ingest_runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  const unavailable = tableUnavailable(runsError);
  if (unavailable) return res.status(200).json({ runs: [], unavailable });
  if (runsError) return fail(res, 500, runsError.message);

  const runIds = (runs || []).map((run) => run.id).filter(Boolean);
  if (runIds.length === 0) return res.status(200).json({ runs: [] });

  const { data: jobs, error: jobsError } = await sb
    .from('ingest_jobs')
    .select('id, run_id, status')
    .in('run_id', runIds);
  const jobsUnavailable = tableUnavailable(jobsError);
  if (jobsError && !jobsUnavailable) return fail(res, 500, jobsError.message);

  const { data: events, error: eventsError } = await sb
    .from('ingest_job_events')
    .select('id, run_id, event, level, message, created_at')
    .in('run_id', runIds)
    .order('created_at', { ascending: false })
    .limit(200);
  const eventsUnavailable = tableUnavailable(eventsError);
  if (eventsError && !eventsUnavailable) return fail(res, 500, eventsError.message);

  const jobsByRun = new Map();
  for (const job of jobsUnavailable ? [] : (jobs || [])) {
    if (!jobsByRun.has(job.run_id)) jobsByRun.set(job.run_id, []);
    jobsByRun.get(job.run_id).push(job);
  }

  const safeEvents = eventsUnavailable ? [] : (events || []);
  const hydratedRuns = (runs || []).map((run) => {
    const latest = latestEventForRun(safeEvents, run.id);
    return {
      ...run,
      job_counts: countJobs(jobsByRun.get(run.id)),
      latest_event_at: latest?.created_at || null,
      latest_event_message: eventMessage(latest),
    };
  });

  return res.status(200).json({
    runs: hydratedRuns,
    ...(jobsUnavailable ? { jobs_unavailable: jobsUnavailable } : {}),
    ...(eventsUnavailable ? { events_unavailable: eventsUnavailable } : {}),
  });
}

async function retryJob(req, res, sb) {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) return fail(res, 400, 'JSON body required');
  if (Object.keys(req.body).some((key) => !RETRY_BODY_KEYS.has(key))) return fail(res, 400, 'Unexpected body field');
  if (req.body.action !== 'retry') return fail(res, 400, 'Unsupported action');
  const jobId = cleanId(req.body.job_id);
  if (!jobId) return fail(res, 400, 'Invalid job_id');

  const { data: job, error: findError } = await sb
    .from('ingest_jobs')
    .select('*')
    .eq('id', jobId)
    .single();
  const unavailable = tableUnavailable(findError);
  if (unavailable) return fail(res, 503, unavailable.message, unavailable.detail);
  if (findError) return fail(res, findError.code === 'PGRST116' ? 404 : 500, findError.message);
  if (!['failed', 'needs_review'].includes(job.status)) return fail(res, 409, 'Only failed or needs_review jobs can be retried');

  const { data: updated, error: updateError } = await sb
    .from('ingest_jobs')
    .update({
      status: 'pending',
      attempts: 0,
      locked_by: null,
      locked_until: null,
      error_message: null,
      completed_at: null,
    })
    .eq('id', jobId)
    .select('*')
    .single();
  if (updateError) return fail(res, 500, updateError.message);

  await sb.from('ingest_runs').update({ status: 'queued', completed_at: null }).eq('id', updated.run_id);
  const eventInsert = await sb.from('ingest_job_events').insert({
    run_id: updated.run_id,
    job_id: updated.id,
    event: 'job_retry_requested',
    level: 'warn',
    message: 'Job queued for retry from admin UI',
    data: { previous_status: job.status },
  });

  return res.status(200).json({
    job: updated,
    ...(eventInsert.error ? { event_warning: eventInsert.error.message } : {}),
  });
}

export default async function handler(req, res) {
  const sb = getServiceSupabase();
  if (!sb) return fail(res, 500, 'Supabase not configured');

  if (req.method === 'GET') return getRuns(req, res, sb);
  if (req.method === 'PATCH') return retryJob(req, res, sb);
  res.setHeader('Allow', 'GET, PATCH');
  return fail(res, 405, 'GET or PATCH only');
}
