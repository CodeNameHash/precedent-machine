'use strict';

// The read path behind /api/product/compare/*. One place decides how a
// released agreement and a draft run are read, so the runs index and the
// comparison cannot disagree about what a draft is:
//
//   FINAL  the current release's layered facts (the published read), which
//          already carry the lawyer's decisions and the coded conclusions;
//   DRAFT  the run's valid, non-rejected facts as the lawyer preview reads
//          them (lib/product/preview-handler.js + previewFactsFromWorkspace),
//          or the stored preview read model when the run is finished and the
//          model is current.
//
// A QUEUED run has no analysis and is not listed. A run the actor may not
// open is never read: published releases are readable by any signed-in user,
// every other run goes through product_run_access.

const { previewFactsFromWorkspace } = require('./provisions-preview');
const { buildPreviewWorkspace } = require('./preview-handler');
const { previewReadModelUsable } = require('./preview-read-model');
const {
  agreementLabel, agreementLabelFromParties, agreementLabelFromUrl,
  compareRunsNewestFirst, isAnalysedRun, phaseLabel, runPhase, statusLabel,
} = require('./comparison-runs');
const { codedFactStats } = require('./comparison-tables');

function comparisonError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function runMeta(run, { published = null, canReview = false } = {}) {
  const phase = published ? 'FINAL' : runPhase(run);
  return {
    run_id: run?.run_id || published?.run_id,
    source_document_id: published?.source_document_id || run?.source_document_id || null,
    agreement_label: published?.agreement_label
      || (run ? agreementLabel(run) : agreementLabel(published)),
    retrieval_url: published?.retrieval_url || run?.retrieval_url || null,
    agreement_date: published?.agreement_date || null,
    parties: Array.isArray(published?.parties) ? published.parties : [],
    phase,
    phase_label: phaseLabel(phase),
    status: published ? (run?.status || 'FINAL') : (run?.status || null),
    status_label: published ? 'Final' : statusLabel(run?.status),
    analysed: isAnalysedRun(published || run),
    created_at: run?.created_at || null,
    released_at: published?.released_at || null,
    generation: run?.source_generation ?? null,
    provider: run?.model_config?.provider_id || null,
    access_role: canReview ? run?.access_role || 'OWNER' : null,
    can_review: canReview,
    released_with_warning: published?.released_with_warning === true,
    release_warning: published?.release_warning || null,
    fact_count: published ? (published.facts || []).length : null,
  };
}

// The runs a signed-in reader may compare: every published release and the
// draft runs the actor can open. Newest first, final and draft together.
async function listComparisonRuns({ store, actor, shapes = null } = {}) {
  const [accessible, published] = await Promise.all([
    store.listRuns({ actor, limit: 200 }),
    store.listPublishedLayeredFacts(),
  ]);
  const byRun = new Map();
  for (const agreement of published) {
    if (!agreement?.run_id) continue;
    const stats = shapes ? codedFactStats(agreement.facts || [], shapes) : {
      coded_fact_count: (agreement.facts || []).filter((fact) => fact?.conclusions).length,
      table_count: new Set((agreement.facts || []).map((fact) => fact?.conclusions?.table_key).filter(Boolean)).size,
      row_count: 0,
    };
    byRun.set(agreement.run_id, {
      ...runMeta({ run_id: agreement.run_id, retrieval_url: agreement.retrieval_url, status: 'FINAL' }, { published: agreement }),
      ...stats,
    });
  }
  for (const run of accessible) {
    if (!run?.run_id) continue;
    const existing = byRun.get(run.run_id);
    if (existing) {
      byRun.set(run.run_id, {
        ...existing,
        status: run.status || existing.status,
        // The phase badge says Final; the run's own status stays beside it
        // rather than replacing the release label.
        run_status_label: run.status ? statusLabel(run.status) : existing.run_status_label,
        created_at: run.created_at || existing.created_at,
        generation: run.source_generation ?? existing.generation,
        provider: run.model_config?.provider_id || existing.provider,
        access_role: run.access_role || existing.access_role,
        can_review: true,
      });
      continue;
    }
    if (String(run.status || '') === 'QUEUED') continue;
    byRun.set(run.run_id, runMeta(run, { canReview: true }));
  }
  return [...byRun.values()].sort(compareRunsNewestFirst);
}

// Counts for the runs index. A draft run's coded cells live in
// product_fact_conclusions and its layered facts in product_fact_headlines;
// two batched reads cover every draft in the list. A release already carries
// its facts, so only drafts are counted here.
async function fillComparisonRunCounts({ store, runs, shapes = null } = {}) {
  const draftIds = (runs || []).filter((run) => run.phase === 'DRAFT').map((run) => run.run_id);
  if (draftIds.length === 0 || !store?.client?.from) return runs;
  const client = store.client;
  const counts = new Map();
  const ensure = (runId) => {
    if (!counts.has(runId)) counts.set(runId, { conclusions: [], factCount: 0 });
    return counts.get(runId);
  };
  const conclusionQuery = client.from('product_fact_conclusions').select('run_id, table_key, row_label, cells');
  if (typeof conclusionQuery.in === 'function') {
    const { data, error } = await conclusionQuery.in('run_id', draftIds);
    if (error) throw comparisonError('DATABASE_ERROR', `comparison conclusions: ${error.message}`);
    for (const row of data || []) {
      ensure(row.run_id).conclusions.push({
        conclusions: { table_key: row.table_key, row_label: row.row_label, cells: row.cells },
      });
    }
  }
  const headlineQuery = client.from('product_fact_headlines').select('run_id');
  if (typeof headlineQuery.in === 'function') {
    const { data, error } = await headlineQuery.in('run_id', draftIds);
    if (error) throw comparisonError('DATABASE_ERROR', `comparison headlines: ${error.message}`);
    for (const row of data || []) ensure(row.run_id).factCount += 1;
  }
  return runs.map((run) => {
    if (run.phase !== 'DRAFT') return run;
    const entry = counts.get(run.run_id);
    if (!entry) return run;
    const stats = codedFactStats(entry.conclusions, shapes);
    return {
      ...run,
      fact_count: entry.factCount || stats.coded_fact_count,
      coded_fact_count: stats.coded_fact_count,
      table_count: stats.table_count,
      row_count: stats.row_count,
    };
  });
}

async function storedPreviewFacts({ store, run, runId }) {
  if (typeof store.getPreviewReadModel !== 'function' || typeof store.getReviewVersion !== 'function') return null;
  let model = null;
  try { model = await store.getPreviewReadModel(runId); } catch { return null; }
  if (!model?.payload) return null;
  let reviewVersion = null;
  try { reviewVersion = await store.getReviewVersion(runId); } catch { return null; }
  if (!previewReadModelUsable({ run, row: model, reviewVersion })) return null;
  return previewFactsFromWorkspace(model.payload).facts;
}

async function livePreviewFacts({ store, actor, runId, context }) {
  const sections = typeof store.loadPreviewSectionResults === 'function'
    ? await store.loadPreviewSectionResults(runId)
    : await store.loadCompletedSectionResults(runId);
  let review = null;
  if (typeof store.getReview === 'function') {
    try { review = await store.getReview({ runId, actor }); } catch { review = null; }
  }
  let draftIssues = [];
  if (typeof store.loadDraftIssues === 'function') {
    try { draftIssues = await store.loadDraftIssues(runId); } catch { draftIssues = []; }
  }
  const workspace = buildPreviewWorkspace({ ...context, sections, review, draftIssues, sandbox: null });
  return previewFactsFromWorkspace(workspace).facts;
}

async function loadDraftAgreement({ store, actor, runId }) {
  // Access is checked before the run row is read, so an unauthorised id is
  // not an existence oracle.
  const accessRole = await store.assertAccess({ runId, actor });
  const run = await store.getRun(runId);
  if (!run) throw comparisonError('RUN_NOT_FOUND', 'analysis run not found');
  let context = null;
  try {
    context = await store.getRunContext(runId);
  } catch (error) {
    // A run stopped before its structure was attached has no facts to
    // compare; it is still a run the index may list. A real database error
    // is not hidden.
    if (!/AgreementStructure not found|analysis run not found/i.test(error?.message || '')) throw error;
  }
  let facts = [];
  if (context) {
    const stored = await storedPreviewFacts({ store, run: context.run || run, runId });
    facts = stored || await livePreviewFacts({ store, actor, runId, context });
  }
  const sourceDocument = context?.sourceDocument || null;
  const label = agreementLabelFromParties(sourceDocument?.parties)
    || agreementLabelFromUrl(run.retrieval_url)
    || String(runId).slice(0, 8);
  return {
    run_id: runId,
    source_document_id: run.source_document_id || null,
    agreement_label: label,
    retrieval_url: run.retrieval_url || null,
    agreement_date: sourceDocument?.agreement_date || null,
    parties: Array.isArray(sourceDocument?.parties) ? sourceDocument.parties : [],
    phase: 'DRAFT',
    phase_label: 'Draft',
    status: run.status || null,
    status_label: statusLabel(run.status),
    analysed: isAnalysedRun(run),
    created_at: run.created_at || null,
    released_at: null,
    generation: run.source_generation ?? null,
    provider: run.model_config?.provider_id || null,
    access_role: accessRole || null,
    can_review: true,
    released_with_warning: false,
    release_warning: null,
    facts: facts.map((fact) => ({ ...fact, run_id: runId })),
  };
}

// Every requested run, in the order asked for. A published run is read from
// its release; anything else must be a draft the actor may open.
async function loadComparisonAgreements({ store, actor, runIds = [] } = {}) {
  const published = await store.listPublishedLayeredFacts();
  const publishedByRun = new Map(published.map((agreement) => [agreement.run_id, agreement]));
  const agreements = [];
  for (const runId of runIds) {
    if (publishedByRun.has(runId)) {
      const agreement = publishedByRun.get(runId);
      agreements.push({
        ...runMeta({ run_id: runId, retrieval_url: agreement.retrieval_url, status: 'FINAL' }, { published: agreement }),
        facts: (agreement.facts || []).map((fact) => ({ ...fact, run_id: runId })),
      });
      continue;
    }
    agreements.push(await loadDraftAgreement({ store, actor, runId }));
  }
  return agreements;
}

// The reference set for "how common": every analysed run the actor can see,
// or the selected runs when the caller asks for a subset. Only conclusion
// rows for the chosen table are read.
async function loadReferenceConclusions({ store, actor, tableKey, runIds = null, shapes = null } = {}) {
  const scope = await listComparisonRuns({ store, actor, shapes });
  const analysedIds = scope.filter((run) => run.analysed).map((run) => run.run_id);
  // The default reference set is finished analysis: only a READY run (or a
  // release) has reached every provision, so only it can be a "not stated"
  // denominator. A PARTIAL, FAILED or RUNNING draft may be compared when the
  // reader selects it explicitly.
  const defaultIds = scope
    .filter((run) => run.analysed && (run.released_at || run.status === 'READY'))
    .map((run) => run.run_id);
  const allowed = new Set(analysedIds);
  let referenceIds = defaultIds;
  if (Array.isArray(runIds) && runIds.length > 0) {
    const missing = runIds.find((runId) => !allowed.has(runId));
    if (missing) throw comparisonError('RUN_NOT_FOUND', `run ${missing} is not in the reference set`);
    referenceIds = [...new Set(runIds)];
  }
  if (referenceIds.length === 0) return { runIds: [], conclusions: [] };
  if (!store?.client?.from) throw comparisonError('DATABASE_ERROR', 'comparison store has no client');
  const builder = store.client.from('product_fact_conclusions')
    .select('run_id, table_key, row_label, cells')
    .in('run_id', referenceIds)
    .eq('table_key', tableKey);
  const { data, error } = await builder;
  if (error) throw comparisonError('DATABASE_ERROR', `comparison conclusions: ${error.message}`);
  return { runIds: referenceIds, conclusions: data || [] };
}

module.exports = {
  comparisonError,
  listComparisonRuns,
  fillComparisonRunCounts,
  loadDraftAgreement,
  loadComparisonAgreements,
  loadReferenceConclusions,
};
