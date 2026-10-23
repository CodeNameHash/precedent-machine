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
const { runSandbox } = require('./sandbox-pool');
const { nodeIssueHeldProposal } = require('./provisions-preview');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// The preview page is a read of the table view, not of the run's stored
// analysis: it reads the deal title from the source document's parties, the
// facts' own fields and components, the section routing and closures, the
// full-section words behind a fact (the evidence sidebar) and the issues
// (held reasons, schema drift, out-of-scope lines). Everything else the
// workspace carries for the review screens is dead weight on this read.
// `source_closures` embeds every span of every section (22.7 MB of the
// 39.8 MB Apogee payload) and `source_document` carries the raw bytes and
// source map (2.8 MB), so the payload is projected to the fields
// `previewFactsFromWorkspace` and `buildTableView` actually read. The
// projection is read-only and the stored rows, the review read and the
// analysis read are unchanged.
const SOURCE_DOCUMENT_FIELDS = ['parties', 'display_parties'];
const NODE_FIELDS = ['node_id', 'reference', 'authored_order'];
const ROUTING_FIELDS = ['structure_node_id', 'section_reference'];
// `authoredSectionHeading` reads the closure's node, reference, id and
// full-section span; `previewFactsFromWorkspace` reads the span id. The
// rest of a closure (its embedded span list, context diagnostics, literal
// span-id lists and SEC mapping) is never read on this page.
const SOURCE_CLOSURE_FIELDS = ['source_closure_id', 'structure_node_id', 'section_reference', 'full_section_span_id'];
const SPAN_FIELDS = ['span_id', 'kind', 'structure_node_id', 'source_closure_ids', 'exact_text', 'start_byte'];
// The issue fields the preview reads: heldReason (code, message,
// proposal_id, structure_node_id, kind), schema drift (issue_id, code,
// message, family_key) and the out-of-scope lines (issue_id, message).
const ISSUE_FIELDS = ['issue_id', 'kind', 'code', 'message', 'proposal_id', 'structure_node_id', 'family_key'];
// The fact fields table-view.js reads; the review item's edits replace the
// statement, headline and components.
const PROPOSAL_FIELDS = [
  'proposal_id', 'structure_node_id', 'family_key', 'subtype_key', 'statement',
  'validation_status', 'headline', 'conclusions', 'coverage_only', 'fact_occurrence_id',
];
// Every component field is read somewhere on the page: the words and
// labels, the byte range the sidebar highlights, the resolution of a
// reference, and the tree's children, members and value.
const COMPONENT_FIELDS = [
  'component_id', 'kind', 'label', 'text', 'origin', 'source_span_id', 'start_byte', 'end_byte',
  'gap_before', 'children', 'members', 'value', 'resolves_to', 'origin_structure_node_id',
];
// The page renders the review of the facts only: the review trail behind a
// fact (decision, comment, date, the fact's edited words) and the fact's
// edited statement/headline/components. The review items for issues,
// coverage, relationships and immaterial routing are never rendered here;
// their decisions only feed counts and can_publish, which the preview does
// not return. A proposal item's `original` is the full proposal duplicated
// in the review row (7.05 MB of review.state on the live Apogee read); the
// review view reads only its group keys to check coherence, and with the
// group key null that check short-circuits, so the preview sends no copy.
const FACT_REVIEW_KINDS = new Set(['PROPOSAL', 'USER_FACT']);
const REVIEW_ITEM_FIELDS = ['kind', 'item_id', 'source_id', 'decision', 'structure_node_id', 'reviewed_at', 'comment', 'edited_statement', 'edited_headline', 'edited_proposition_group_id'];

function pickFields(value, fields) {
  if (!value || typeof value !== 'object') return value;
  const projected = {};
  for (const field of fields) {
    if (Object.hasOwn(value, field)) projected[field] = value[field];
  }
  return projected;
}

// Empty defaults the page reads as absent (`gap_before === true`, a truthy
// value, children as a list) are left out rather than sent on every one of
// the thousands of components.
function projectComponent(component) {
  if (!component || typeof component !== 'object') return component;
  const projected = {};
  for (const field of COMPONENT_FIELDS) {
    if (!Object.hasOwn(component, field)) continue;
    const value = component[field];
    if (field === 'gap_before' && value === false) continue;
    if (['members', 'value', 'resolves_to', 'origin_structure_node_id', 'start_byte', 'end_byte'].includes(field) && value === null) continue;
    if (field === 'children' && Array.isArray(value) && value.length === 0) continue;
    projected[field] = field === 'children' ? value.map(projectComponent) : value;
  }
  return projected;
}

function projectProposal(proposal) {
  if (!proposal || typeof proposal !== 'object') return proposal;
  const projected = pickFields(proposal, PROPOSAL_FIELDS);
  if (Object.hasOwn(proposal, 'components')) {
    projected.components = Array.isArray(proposal.components) ? proposal.components.map(projectComponent) : proposal.components;
  }
  return projected;
}

// Fields read by lib/product/review-view.js for the review items it builds.
// A proposal's original is empty on purpose (see above); a user fact's
// original is the fact itself, projected like a proposal.
function projectReviewItem(item) {
  if (!item || !FACT_REVIEW_KINDS.has(item.kind)) return null;
  const projected = pickFields(item, REVIEW_ITEM_FIELDS);
  // null means "not edited" everywhere the page reads these.
  for (const field of ['reviewed_at', 'comment', 'edited_statement', 'edited_headline', 'edited_proposition_group_id']) {
    if (projected[field] === null || projected[field] === undefined) delete projected[field];
  }
  if (item.kind === 'USER_FACT') {
    projected.original = projectProposal(item.original || {});
  } else {
    // A proposal item's node is not read on the preview; its fact already
    // carries it.
    delete projected.structure_node_id;
    projected.original = {};
  }
  if (Object.hasOwn(item, 'edited_components')) {
    projected.edited_components = Array.isArray(item.edited_components)
      ? item.edited_components.map(projectComponent) : item.edited_components;
  }
  return projected;
}

// review.state also carries metrics, timings, ids and the release evaluation;
// the page reads its status (the header badge), the fact items and the
// agreement coverage decision buildReviewView's can_publish reads.
function projectPreviewReview(review) {
  if (!review || !review.state) return review;
  return {
    version: review.version,
    state: {
      status: review.state.status,
      items: (review.state.items || []).map(projectReviewItem).filter(Boolean),
      agreement_coverage: { decision: review.state.agreement_coverage?.decision ?? 'PENDING' },
      ...(Object.hasOwn(review.state, 'relationship_review_coherent')
        ? { relationship_review_coherent: review.state.relationship_review_coherent } : {}),
    },
  };
}

// heldReason is the only reader of an issue's proposal/node link: it reads
// every issue on a held proposal and the held node's validation issues
// (the node-level issues whose candidates name the proposal, and the
// INVALID_FACT_COMPONENTS issues that tell a held problem its span is
// unknown). The schema-drift and out-of-scope lines are read by code. Every
// other issue (the bulk: conclusions and validation notes for valid facts)
// is never read on this page.
function previewIssues(proposals, issues) {
  const held = (proposals || []).filter((proposal) => proposal && proposal.validation_status !== 'VALID');
  const heldIds = new Set(held.map((proposal) => proposal.proposal_id));
  const heldNodes = new Set(held.map((proposal) => proposal.structure_node_id).filter(Boolean));
  return (issues || []).filter((issue) => {
    if (!issue) return false;
    if (issue.code === 'SCHEMA_DRIFT_FACT_TYPE' || issue.code === 'OUT_OF_SCOPE_EXHIBIT') return true;
    if (issue.proposal_id && heldIds.has(issue.proposal_id)) return true;
    if (!heldNodes.has(issue.structure_node_id)) return false;
    if (issue.code === 'INVALID_FACT_COMPONENTS') return true;
    return held.some((proposal) => proposal.structure_node_id === issue.structure_node_id
      && nodeIssueHeldProposal(issue, proposal));
  });
}

function projectPreviewAnalysis(analysis) {
  const closures = (analysis.source_closures || []).map((closure) => pickFields(closure, SOURCE_CLOSURE_FIELDS));
  // The page cites a full-section span through its closure, and the evidence
  // sidebar renders that span's words; no other span is read.
  const fullSectionSpanIds = new Set(closures.map((closure) => closure?.full_section_span_id).filter(Boolean));
  const proposals = analysis.proposals || [];
  return {
    schema_version: analysis.schema_version,
    analysis_run_id: analysis.analysis_run_id,
    legal_schema_version: analysis.legal_schema_version,
    source_document: pickFields(analysis.source_document, SOURCE_DOCUMENT_FIELDS),
    agreement_structure: { nodes: (analysis.agreement_structure?.nodes || []).map((node) => pickFields(node, NODE_FIELDS)) },
    sections: (analysis.sections || []).map((routing) => pickFields(routing, ROUTING_FIELDS)),
    source_closures: closures,
    spans: (analysis.spans || []).filter((span) => fullSectionSpanIds.has(span.span_id)).map((span) => pickFields(span, SPAN_FIELDS)),
    proposals: proposals.map(projectProposal),
    issues: previewIssues(proposals, analysis.issues).map((issue) => pickFields(issue, ISSUE_FIELDS)),
  };
}

function displaySourceDocument(sourceDocument) {
  const parties = sourceDocument?.parties;
  if (!partyIdentityNeedsDisplayRepair(parties)) return sourceDocument;
  const displayParties = recoverPartyIdentityForDisplay(parties, sourceDocument.canonical_text);
  return displayParties ? { ...sourceDocument, display_parties: displayParties } : sourceDocument;
}

// Pure: turns the run context, the completed section results and the saved
// review (if any) into a workspace-shaped payload for previewFactsFromWorkspace.
// `draftIssues` are the issues finalisation stores at draft level (no
// structure node): the section results never carry them, so they ride into
// analysis.issues beside the sections' own for the page's drift lines.
function buildPreviewWorkspace({ run, sourceDocument, agreementStructure, sections, review = null, draftIssues = [], sandbox = null }) {
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
    issues: [...sections.flatMap((section) => section.issues || []), ...draftIssues],
    coverage_assertions: sections.flatMap((section) => section.coverage || []),
  };
  // The run's substantive-section count is read before the structure is
  // projected to the node fields the page uses.
  const total = substantiveSections(agreementStructure).length;
  return {
    schema_version: 'PRODUCT_PREVIEW_WORKSPACE/V1',
    analysis: projectPreviewAnalysis(analysis),
    review: projectPreviewReview(review && review.state
      ? { version: review.version, state: review.state }
      : { version: 0, state: { status: 'DRAFT', items: [], agreement_coverage: { decision: 'PENDING' } } }),
    // The run's generation rides along for the page header (Ben, 2026-09-14:
    // the metadata line shows "what the run knows").
    progress: { status: run.status, stage: run.stage, completed: sections.length, total, generation: run.source_generation ?? null, provider: run.model_config?.provider_id ?? null,
      // The worker sandbox the run is on (plan finding (140)); null before
      // its first wake on the pool.
      sandbox: sandbox && sandbox.live ? sandbox.sandbox_name : null },
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
      // The preview store read skips the model calls and the tables the page
      // never renders (phase-2-store loadPreviewSectionResults); a store
      // without it (an older deployment, a test double) still reads the full
      // completed sections and the projection below leaves the same payload.
      const sections = typeof store.loadPreviewSectionResults === 'function'
        ? await store.loadPreviewSectionResults(runId)
        : await store.loadCompletedSectionResults(runId);
      const draftIssues = typeof store.loadDraftIssues === 'function' ? await store.loadDraftIssues(runId) : [];
      let review = null;
      if (typeof store.getReview === 'function') {
        try { review = await store.getReview({ runId, actor }); } catch { review = null; }
      }
      const sandbox = await runSandbox(store, runId);
      // A finished run's read may be reused for a minute by the same
      // browser; a run still analysing must not be (its sections arrive as
      // they commit). Ben, 2026-10-23: "the preview page opened very
      // slowly". Work package 32 cut the payload from 45.7 MB to 3.9 MB;
      // what remains is the database's scan of a 97-section run's rows
      // (about 16 s), so a repeat view is served from the browser's cache.
      const finished = ['READY', 'FAILED'].includes(String(context?.run?.status || ''));
      res.setHeader('Cache-Control', finished ? 'private, max-age=60' : 'private, no-store');
      return res.status(200).json(buildPreviewWorkspace({ ...context, sections, review, draftIssues, sandbox }));
    } catch (error) {
      if (error instanceof ProductRequestAuthError || error?.code === 'UNAUTHENTICATED') return res.status(401).json({ error: 'UNAUTHENTICATED' });
      if (error?.code === 'ACCESS_DENIED' || /access denied/i.test(error?.message || '')) return res.status(404).json({ error: 'Analysis run not found' });
      if (/analysis run not found/i.test(error?.message || '')) return res.status(404).json({ error: 'Analysis run not found' });
      console.error('[product-preview]', error);
      return res.status(500).json({ error: 'Preview could not be read' });
    }
  };
}

module.exports = { buildPreviewWorkspace, createProductPreviewHandler, projectPreviewAnalysis, projectPreviewReview };
