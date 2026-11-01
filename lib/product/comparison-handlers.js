'use strict';

// The four read-only comparison routes: the runs index, the coded tables for
// the selected runs, the how-common distribution for one table, and the
// market distribution behind the in-page Compare toggle. Factories so the
// routes and the tests share one handler (the same pattern as
// lib/product/published-facts-handler.js).

const { ProductPhase3Store } = require('./phase-3-store');
const { ProductRequestAuthError, getProductActor } = require('./request-auth');
const { UUID, parseRunIdList } = require('./comparison-runs');
const {
  comparisonError, listComparisonRuns, fillComparisonRunCounts,
  loadComparisonAgreements, loadReferenceViews,
} = require('./comparison-read');
const {
  buildComparisonTablesFromViews, codedFactStats, howCommonFromViews, marketDistribution,
} = require('./comparison-tables');
const tableShapes = require('../../contracts/product/table-shapes.v3.json');
const legalSchema = require('../../contracts/product/legal-schema.v2.json');

function firstValue(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

function errorStatus(error) {
  if (error instanceof ProductRequestAuthError) return error.code === 'CSRF_REQUIRED' ? 403 : 401;
  if (error?.code === 'UNAUTHENTICATED') return 401;
  if (error?.code === 'ACCESS_DENIED' || error?.code === 'RUN_NOT_FOUND') return 404;
  return 500;
}

function sendError(res, error, label) {
  const status = errorStatus(error);
  if (status === 401) return res.status(401).json({ error: 'UNAUTHENTICATED' });
  if (status === 403) return res.status(403).json({ error: 'CSRF_REQUIRED' });
  if (status === 404) return res.status(404).json({ error: 'Run not found' });
  console.error(`[product-compare:${label}]`, error);
  return res.status(500).json({ error: 'The comparison could not be read' });
}

function factoryDefaults(options) {
  if (typeof options?.getClient !== 'function') throw new TypeError('getClient is required');
  return {
    getClient: options.getClient,
    storeFactory: options.storeFactory || ((client) => new ProductPhase3Store({ client })),
    actorResolver: options.actorResolver || getProductActor,
  };
}

function createComparisonRunsHandler(options = {}) {
  const { getClient, storeFactory, actorResolver } = factoryDefaults(options);
  return async function comparisonRunsHandler(req, res) {
    res.setHeader('Cache-Control', 'private, no-store');
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ error: 'GET only' });
    }
    const client = getClient();
    if (!client) return res.status(500).json({ error: 'Product database is not configured' });
    try {
      const actor = await actorResolver(req);
      const store = storeFactory(client);
      let runs = await listComparisonRuns({ store, actor, shapes: tableShapes });
      try {
        runs = await fillComparisonRunCounts({ store, runs, shapes: tableShapes });
      } catch (countError) {
        // The list is the answer; a missing count column does not hide a run.
        console.error('[product-compare:runs] counts:', countError?.message || countError);
      }
      return res.status(200).json({ schema_version: 'PRODUCT_COMPARE_RUNS/V1', runs });
    } catch (error) {
      return sendError(res, error, 'runs');
    }
  };
}

function createComparisonTablesHandler(options = {}) {
  const { getClient, storeFactory, actorResolver } = factoryDefaults(options);
  return async function comparisonTablesHandler(req, res) {
    res.setHeader('Cache-Control', 'private, no-store');
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ error: 'GET only' });
    }
    const parsed = parseRunIdList(firstValue(req.query?.runs), { min: 1, max: 6 });
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const client = getClient();
    if (!client) return res.status(500).json({ error: 'Product database is not configured' });
    try {
      const actor = await actorResolver(req);
      const store = storeFactory(client);
      const agreements = await loadComparisonAgreements({
        store, actor, runIds: parsed.ids, tableShapes, legalSchema,
      });
      const tables = buildComparisonTablesFromViews(agreements.map((agreement) => ({
        run_id: agreement.run_id,
        agreement_label: agreement.agreement_label,
        ...agreement.view,
      })));
      const runs = agreements.map(({ facts, view, ...meta }) => ({
        ...meta,
        fact_count: (facts || []).length,
        ...codedFactStats(facts || [], tableShapes),
      }));
      return res.status(200).json({
        schema_version: 'PRODUCT_COMPARE_TABLES/V1',
        table_shapes_version: tableShapes.schema_version || null,
        runs,
        tables,
      });
    } catch (error) {
      if (!(error instanceof ProductRequestAuthError) && !error?.code) {
        return sendError(res, comparisonError('DATABASE_ERROR', error?.message || 'comparison failed'), 'tables');
      }
      return sendError(res, error, 'tables');
    }
  };
}

function createComparisonHowCommonHandler(options = {}) {
  const { getClient, storeFactory, actorResolver } = factoryDefaults(options);
  return async function comparisonHowCommonHandler(req, res) {
    res.setHeader('Cache-Control', 'private, no-store');
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ error: 'GET only' });
    }
    const tableKey = firstValue(req.query?.table);
    if (!tableKey) return res.status(400).json({ error: 'table is required' });
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/.test(tableKey)) return res.status(400).json({ error: 'invalid table key' });
    const rawRuns = firstValue(req.query?.runs);
    let selected = null;
    if (rawRuns) {
      const parsed = parseRunIdList(rawRuns, { min: 1, max: 6 });
      if (parsed.error) return res.status(400).json({ error: parsed.error });
      selected = parsed.ids;
    }
    const client = getClient();
    if (!client) return res.status(500).json({ error: 'Product database is not configured' });
    try {
      const actor = await actorResolver(req);
      const store = storeFactory(client);
      const views = await loadReferenceViews({
        store, actor, runIds: selected, tableShapes, legalSchema,
      });
      const distribution = howCommonFromViews(views.map((agreement) => ({
        run_id: agreement.run_id,
        agreement_label: agreement.agreement_label,
        ...agreement.view,
      })), tableKey);
      return res.status(200).json({
        schema_version: 'PRODUCT_COMPARE_HOW_COMMON/V1',
        scope: selected ? 'SELECTED' : 'ALL',
        reference: { run_ids: views.map((view) => view.run_id), runs_total: views.length },
        ...distribution,
      });
    } catch (error) {
      return sendError(res, error, 'how-common');
    }
  };
}

function createComparisonMarketHandler(options = {}) {
  const { getClient, storeFactory, actorResolver } = factoryDefaults(options);
  return async function comparisonMarketHandler(req, res) {
    res.setHeader('Cache-Control', 'private, no-store');
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ error: 'GET only' });
    }
    const runId = firstValue(req.query?.run);
    if (!runId) return res.status(400).json({ error: 'run is required' });
    if (!UUID.test(runId)) return res.status(400).json({ error: 'invalid run id' });
    const client = getClient();
    if (!client) return res.status(500).json({ error: 'Product database is not configured' });
    try {
      const actor = await actorResolver(req);
      const store = storeFactory(client);
      const scope = await listComparisonRuns({ store, actor, shapes: tableShapes });
      const selected = scope.find((run) => run.run_id === runId && run.analysed) || null;
      if (!selected) return res.status(404).json({ error: 'Run not found' });
      // The reference is the finished runs plus the deal being read, so a
      // reader on a PARTIAL draft still sees where its answers sit. A
      // PARTIAL run is still not a default denominator on its own.
      const referenceIds = scope
        .filter((run) => run.comparable || run.run_id === runId)
        .map((run) => run.run_id)
        .slice(0, 60);
      const views = await loadReferenceViews({
        store, actor, runIds: referenceIds, tableShapes, legalSchema,
      });
      const distribution = marketDistribution(views.map((agreement) => ({
        run_id: agreement.run_id,
        agreement_label: agreement.agreement_label,
        ...agreement.view,
      })), runId);
      return res.status(200).json({
        schema_version: 'PRODUCT_COMPARE_MARKET/V1',
        run: runId,
        ...distribution,
      });
    } catch (error) {
      return sendError(res, error, 'market');
    }
  };
}

module.exports = {
  createComparisonRunsHandler,
  createComparisonTablesHandler,
  createComparisonHowCommonHandler,
  createComparisonMarketHandler,
};
