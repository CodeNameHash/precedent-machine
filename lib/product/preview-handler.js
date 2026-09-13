'use strict';

// Live lawyer preview read: the sections a run has completed so far, in the
// shape the Review workspace uses, whether or not the run has finalised. The
// preview page (pages/review/product/[id]/provisions.js) reads this while a
// run is still analysing so the tables fill in section by section, and keeps
// reading it once the run is READY (the saved review state, when one exists,
// is applied so the reviewer's edits show). Read-only: no command path.

const { ProductPhase3Store } = require('./phase-3-store');
const { ProductRequestAuthError, getProductActor } = require('./request-auth');
const { partyIdentityNeedsDisplayRepair, recoverPartyIdentityForDisplay } = require('./sec-intake');
const { substantiveSections } = require('./source-context');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function displaySourceDocument(sourceDocument) {
  const parties = sourceDocument?.parties;
  if (!partyIdentityNeedsDisplayRepair(parties)) return sourceDocument;
  const displayParties = recoverPartyIdentityForDisplay(parties, sourceDocument.canonical_text);
  return displayParties ? { ...sourceDocument, display_parties: displayParties } : sourceDocument;
}

// Pure: turns the run context, the completed section results and the saved
// review (if any) into a workspace-shaped payload for previewFactsFromWorkspace.
function buildPreviewWorkspace({ run, sourceDocument, agreementStructure, sections, review = null }) {
  const spans = new Map();
  for (const section of sections) for (const span of section.spans || []) spans.set(span.span_id, span);
  const analysis = {
    schema_version: 'PRODUCT_PREVIEW_ANALYSIS/V1',
    analysis_run_id: run.run_id,
    legal_schema_version: run.schema_version,
    source_document: displaySourceDocument(sourceDocument),
    agreement_structure: agreementStructure,
    sections: sections.map((section) => section.routing),
    source_closures: sections.map((section) => section.source_closure),
    spans: [...spans.values()],
    proposals: sections.flatMap((section) => section.proposals || []),
    proposition_groups: sections.flatMap((section) => section.groups || []),
    fact_links: sections.flatMap((section) => section.links || []),
    issues: sections.flatMap((section) => section.issues || []),
    coverage_assertions: sections.flatMap((section) => section.coverage || []),
  };
  const total = substantiveSections(agreementStructure).length;
  return {
    schema_version: 'PRODUCT_PREVIEW_WORKSPACE/V1',
    analysis,
    review: review && review.state
      ? { version: review.version, state: review.state }
      : { version: 0, state: { status: 'DRAFT', items: [], agreement_coverage: { decision: 'PENDING' } } },
    progress: { status: run.status, stage: run.stage, completed: sections.length, total },
  };
}

function createProductPreviewHandler({
  getClient, storeFactory = (client) => new ProductPhase3Store({ client }), actorResolver = getProductActor,
} = {}) {
  if (typeof getClient !== 'function') throw new TypeError('getClient is required');
  return async function productPreviewHandler(req, res) {
    res.setHeader('Cache-Control', 'private, no-store');
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    const runId = Array.isArray(req.query?.id) ? req.query.id[0] : req.query?.id;
    if (!UUID.test(runId || '')) return res.status(400).json({ error: 'Invalid analysis run ID' });
    try {
      const actor = await actorResolver(req);
      const client = getClient();
      if (!client) return res.status(500).json({ error: 'Product database is not configured' });
      const store = storeFactory(client);
      await store.assertAccess({ runId, actor });
      const context = await store.getRunContext(runId);
      const sections = await store.loadCompletedSectionResults(runId);
      let review = null;
      if (typeof store.getReview === 'function') {
        try { review = await store.getReview({ runId, actor }); } catch { review = null; }
      }
      return res.status(200).json(buildPreviewWorkspace({ ...context, sections, review }));
    } catch (error) {
      if (error instanceof ProductRequestAuthError || error?.code === 'UNAUTHENTICATED') return res.status(401).json({ error: 'UNAUTHENTICATED' });
      if (error?.code === 'ACCESS_DENIED' || /access denied/i.test(error?.message || '')) return res.status(404).json({ error: 'Analysis run not found' });
      if (/analysis run not found/i.test(error?.message || '')) return res.status(404).json({ error: 'Analysis run not found' });
      console.error('[product-preview]', error);
      return res.status(500).json({ error: 'Preview could not be read' });
    }
  };
}

module.exports = { buildPreviewWorkspace, createProductPreviewHandler };
