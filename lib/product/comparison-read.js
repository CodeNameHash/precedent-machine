'use strict';

// The read path behind /api/product/compare/*. One place decides how a
// released agreement and a draft run are read, and the one place that builds
// the page view every comparison surface uses:
//
//   FINAL  the current release's layered facts (the published read), which
//          already carry the lawyer's decisions and the coded conclusions;
//   DRAFT  the run's valid, non-rejected facts as the lawyer preview reads
//          them (lib/product/preview-handler.js + previewFactsFromWorkspace),
//          or the stored preview read model when the run is finished and the
//          model is current.
//
// The view is buildTableView() (lib/product/comparison-view.js), the same
// view ProvisionTables renders. It is cached in-process by run id, the run's
// updated_at and the review version, so the market read and the compare read
// do not rebuild it on every request (package 1 review, blockers 1-3 and the
// cache should-fix; package 2 note section 3).
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
const { buildComparisonView } = require('./comparison-view');

const VIEW_CACHE = new Map();
const VIEW_CACHE_LIMIT = 80;
const READ_CONCURRENCY = 4;
const REFERENCE_LIMIT = 60;
const PAGE_SIZE = 500;

function comparisonError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function cacheKey(runId, updatedAt, reviewVersion = null) {
  return `${runId}:${updatedAt || ''}:${reviewVersion == null ? '' : reviewVersion}`;
}

function cacheView(key, view) {
  if (!key) return view;
  VIEW_CACHE.set(key, view);
  while (VIEW_CACHE.size > VIEW_CACHE_LIMIT) {
    const oldest = VIEW_CACHE.keys().next().value;
    VIEW_CACHE.delete(oldest);
  }
  return view;
}

function runMeta(run, { published = null, canReview = false } = {}) {
  const phase = published ? 'FINAL' : runPhase(run);
  const status = published ? (run?.status || 'FINAL') : (run?.status || null);
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
    status,
    status_label: published ? 'Final' : statusLabel(run?.status),
    analysed: isAnalysedRun(published || run),
    // A release and a READY draft have reached every provision; a PARTIAL,
    // FAILED or RUNNING run has not. The comparison keeps the latter out of
    // the default reference and default selection (PR 490 review should-fix).
    comparable: !!(published?.released_at || run?.status === 'READY' || (published && !run)),
    created_at: run?.created_at || null,
    updated_at: run?.updated_at || published?.released_at || null,
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
        run_status_label: run.status ? statusLabel(run.status) : existing.run_status_label,
        created_at: run.created_at || existing.created_at,
        updated_at: run.updated_at || existing.updated_at,
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

async function readAllRunRows(client, table, columns, runId) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const query = client.from(table).select(columns).eq('run_id', runId).range(from, from + PAGE_SIZE - 1);
    const { data, error } = await query;
    if (error) throw comparisonError('DATABASE_ERROR', `${table}: ${error.message}`);
    const page = data || [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

async function mapLimit(items, limit, worker) {
  const out = new Array(items.length);
  let next = 0;
  async function run() {
    for (;;) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      out[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return out;
}

// Counts for the runs index. Both reads page, so PostgREST's 1,000-row cap
// cannot silently truncate a draft's counts (PR 490 review blocker 4).
async function fillComparisonRunCounts({ store, runs, shapes = null } = {}) {
  const draftIds = (runs || []).filter((run) => run.phase === 'DRAFT').map((run) => run.run_id);
  if (draftIds.length === 0 || !store?.client?.from) return runs;
  const client = store.client;
  const stats = await mapLimit(draftIds, READ_CONCURRENCY, async (runId) => {
    const conclusions = await readAllRunRows(client, 'product_fact_conclusions', 'run_id, table_key, row_label, cells', runId);
    const headlines = await readAllRunRows(client, 'product_fact_headlines', 'run_id', runId);
    return {
      runId,
      factCount: headlines.length,
      coded: codedFactStats(conclusions.map((row) => ({
        conclusions: { table_key: row.table_key, row_label: row.row_label, cells: row.cells },
      })), shapes),
    };
  });
  const byRun = new Map(stats.map((entry) => [entry.runId, entry]));
  return runs.map((run) => {
    if (run.phase !== 'DRAFT') return run;
    const entry = byRun.get(run.run_id);
    if (!entry) return run;
    return {
      ...run,
      fact_count: entry.factCount || entry.coded.coded_fact_count,
      coded_fact_count: entry.coded.coded_fact_count,
      table_count: entry.coded.table_count,
      row_count: entry.coded.row_count,
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
  const preview = previewFactsFromWorkspace(model.payload);
  return { facts: preview.facts, heldFacts: preview.held_facts || [] };
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
  const preview = previewFactsFromWorkspace(workspace);
  return { facts: preview.facts, heldFacts: preview.held_facts || [] };
}

async function loadDraftAgreement({ store, actor, runId, tableShapes = null, legalSchema = null, publishedByRun = null } = {}) {
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
  let heldFacts = [];
  let reviewVersion = null;
  if (context) {
    // The same facts and held facts the provisions page builds its view
    // from (previewFactsFromWorkspace), so a comparison never disagrees
    // with the page (PR 490 re-review).
    const read = await storedPreviewFacts({ store, run: context.run || run, runId }) || await livePreviewFacts({ store, actor, runId, context });
    facts = read.facts || [];
    heldFacts = read.heldFacts || [];
    if (typeof store.getReviewVersion === 'function') {
      try { reviewVersion = await store.getReviewVersion(runId); } catch { reviewVersion = null; }
    }
  }
  const sourceDocument = context?.sourceDocument || null;
  const label = agreementLabelFromParties(sourceDocument?.parties)
    || agreementLabelFromUrl(run.retrieval_url)
    || String(runId).slice(0, 8);
  const key = cacheKey(runId, run.updated_at || run.created_at, reviewVersion);
  let view = VIEW_CACHE.get(key) || null;
  if (!view) {
    view = buildComparisonView({ facts, heldFacts, tableShapes, legalSchema, agreementDate: context?.sourceDocument?.agreement_date || null });
    cacheView(key, view);
  }
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
    comparable: run.status === 'READY',
    created_at: run.created_at || null,
    updated_at: run.updated_at || null,
    released_at: null,
    generation: run.source_generation ?? null,
    provider: run.model_config?.provider_id || null,
    access_role: accessRole || null,
    can_review: true,
    released_with_warning: false,
    release_warning: null,
    facts,
    review_version: reviewVersion,
    view,
  };
}

async function loadOneAgreement({ store, actor, runId, publishedByRun, tableShapes, legalSchema }) {
  if (publishedByRun?.has(runId)) {
    const agreement = publishedByRun.get(runId);
    const key = cacheKey(runId, agreement.released_at || 'release');
    let view = VIEW_CACHE.get(key) || null;
    if (!view) {
      view = buildComparisonView({ facts: agreement.facts || [], tableShapes, legalSchema });
      cacheView(key, view);
    }
    return {
      ...runMeta({ run_id: runId, retrieval_url: agreement.retrieval_url, status: 'FINAL' }, { published: agreement }),
      facts: (agreement.facts || []).map((fact) => ({ ...fact, run_id: runId })),
      view,
    };
  }
  return loadDraftAgreement({ store, actor, runId, tableShapes, legalSchema });
}

// Every requested run, in the order asked for. A published run is read from
// its release; anything else must be a draft the actor may open. `views` are
// built here, once per run, and cached. The published read is fetched once
// per call, not once per run.
async function loadComparisonAgreements({
  store, actor, runIds = [], tableShapes = null, legalSchema = null,
} = {}) {
  const published = await store.listPublishedLayeredFacts();
  const publishedByRun = new Map(published.map((agreement) => [agreement.run_id, agreement]));
  return mapLimit(runIds, READ_CONCURRENCY, (runId) => loadOneAgreement({
    store, actor, runId, publishedByRun, tableShapes, legalSchema,
  }));
}

async function loadComparisonViews(options = {}) {
  return loadComparisonAgreements(options);
}

// The reference set for "how common" and the market line: every analysed run
// the actor can see, or the selected runs. A PARTIAL, FAILED or RUNNING run
// is not a default denominator; the reader may still select one explicitly.
async function loadReferenceViews({
  store, actor, runIds = null, tableShapes = null, legalSchema = null,
} = {}) {
  const scope = await listComparisonRuns({ store, actor, shapes: tableShapes });
  const analysedIds = scope.filter((run) => run.analysed).map((run) => run.run_id);
  const defaultIds = scope.filter((run) => run.comparable).map((run) => run.run_id);
  const allowed = new Set(analysedIds);
  let referenceIds = defaultIds;
  if (Array.isArray(runIds) && runIds.length > 0) {
    const missing = runIds.find((runId) => !allowed.has(runId));
    if (missing) throw comparisonError('RUN_NOT_FOUND', `run ${missing} is not in the reference set`);
    referenceIds = [...new Set(runIds)];
  }
  referenceIds = referenceIds.slice(0, REFERENCE_LIMIT);
  if (referenceIds.length === 0) return [];
  const published = await store.listPublishedLayeredFacts();
  const publishedByRun = new Map(published.map((agreement) => [agreement.run_id, agreement]));
  return mapLimit(referenceIds, READ_CONCURRENCY, (runId) => loadOneAgreement({
    store, actor, runId, publishedByRun, tableShapes, legalSchema,
  }));
}

module.exports = {
  comparisonError,
  listComparisonRuns,
  fillComparisonRunCounts,
  loadDraftAgreement,
  loadComparisonAgreements,
  loadComparisonViews,
  loadReferenceViews,
  cacheKey,
};
