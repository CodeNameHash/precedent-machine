/**
 * Resolver-finalisation duplicate suppression.
 *
 * This pass never shapes, resolves, or rewrites a claim. It compares an
 * MAE generic open-world carrier with the final resolved typed claim that
 * originated from the same verified source assertion. OFF is referentially
 * inert. REPORT_ONLY records decisions. ENFORCE removes only proven carriers.
 */
'use strict';

const { canonicalJson, contentId, utf8Slice } = require('../canonical-bytes');

const DUPLICATE_SUPPRESSION_SCHEMA = 'DUPLICATE_SUPPRESSION/V1';
const RECEIPT_SCHEMA = 'DUPLICATE_SUPPRESSION_RECEIPT/V1';
const MODES = Object.freeze({ OFF: 'OFF', REPORT_ONLY: 'REPORT_ONLY', ENFORCE: 'ENFORCE' });
const GENERIC_KEY = 'NATIVE_CAPITALISATION_LIMB_ASSERTION_CANDIDATE';
const TYPED_KEYS = new Set(['MAE_DEFINITION_PRONG', 'MAE_CARVEOUT', 'MAE_DISPROPORTIONALITY_CARVEBACK']);
const TYPED_SOURCE_KEYS = new Set([
  'NATIVE_MAE_DEFINITION_PRONG_CANDIDATE',
  'NATIVE_MAE_CARVEOUT_CANDIDATE',
  'NATIVE_MAE_DISPROPORTIONALITY_CANDIDATE',
]);

function freeze(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(freeze));
  if (value && typeof value === 'object') return Object.freeze(Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, freeze(child)]),
  ));
  return value;
}

function equal(left, right) { return canonicalJson(left) === canonicalJson(right); }
function operativeEdge(claim) {
  const edges = claim?.evidence;
  if (!Array.isArray(edges)) return null;
  const matches = edges.filter((edge) => edge?.evidence_role === 'OPERATIVE_TEXT');
  return matches.length === 1 ? matches[0] : null;
}
function rootPath(path) {
  if (path == null || (Array.isArray(path) && path.length === 0)) return [];
  return Array.isArray(path) ? path : null;
}
function attrs(claim) { return claim?.attributes && typeof claim.attributes === 'object' ? claim.attributes : {}; }
function sourceClaim(entry) { return entry?.ok === true && entry?.candidate?.kind === 'claim' ? entry.candidate.claim : null; }
function isMaeCarrier(entry, claim) {
  return entry?.section_family === 'MAE_DEFINITION'
    && claim?.claim_definition_key === GENERIC_KEY
    && typeof attrs(claim).defined_term_ref === 'string'
    && typeof attrs(claim).definition_subject === 'string';
}
function isTypedMae(entry, claim) {
  return entry?.section_family === 'MAE_DEFINITION'
    && TYPED_SOURCE_KEYS.has(claim?.claim_definition_key)
    && typeof attrs(claim).defined_term_ref === 'string'
    && typeof attrs(claim).definition_subject === 'string';
}
function sourceIndex(receipt) {
  const byClosure = new Map(); const typed = [];
  for (const entry of receipt?.compiled_candidates || []) {
    const claim = sourceClaim(entry); if (!claim) continue;
    if (typeof claim.closure_id === 'string') {
      const rows = byClosure.get(claim.closure_id) || []; rows.push({ entry, claim }); byClosure.set(claim.closure_id, rows);
    }
    if (isTypedMae(entry, claim)) typed.push({ entry, claim });
  }
  return { byClosure, typed };
}
function sourceSpanVerified({ claim, receipt, source }) {
  const edge = operativeEdge(claim); const section = (receipt?.resolved_sections || [])
    .find((item) => item?.section_reference === attrs(claim).section_reference);
  const text = source?.canonical_text?.text;
  if (!edge || !section || typeof text !== 'string' || !Number.isInteger(section.start)
    || !Number.isInteger(edge.absolute_start) || !Number.isInteger(edge.absolute_end)
    || edge.absolute_end <= edge.absolute_start || edge.document_ordinal !== 0) return null;
  try {
    const quoted = utf8Slice(text, section.start + edge.absolute_start, section.start + edge.absolute_end);
    if (quoted !== claim.raw_value) return null;
    return { document_ordinal: edge.document_ordinal, absolute_start: edge.absolute_start, absolute_end: edge.absolute_end };
  } catch (_error) { return null; }
}
function sameBase(carrier, peer) {
  const left = attrs(carrier); const right = attrs(peer);
  return left.section_reference === right.section_reference
    && left.defined_term_ref === right.defined_term_ref
    && left.definition_subject === right.definition_subject
    && equal(rootPath(left.limb_path), rootPath(right.limb_path));
}
function sameOperativeAssertion(carrier, peer, receipt, source) {
  const carrierSpan = sourceSpanVerified({ claim: carrier, receipt, source });
  const peerSpan = sourceSpanVerified({ claim: peer, receipt, source });
  return carrierSpan && peerSpan && carrier.raw_value === peer.raw_value && equal(carrierSpan, peerSpan)
    ? carrierSpan : null;
}
function qualifierShape(claim) {
  const a = attrs(claim);
  return {
    qualifier_attachment: a.qualifier_attachment || null,
    qualifier_attachment_id: a.qualifier_attachment_id || null,
    attachment_position: a.attachment_position || null,
    qualifier_governed_path: a.qualifier_governed_path || null,
  };
}
function treeReferencesCarrier(trees, carrier) {
  const needles = [carrier.claim_occurrence_id, carrier.claim_revision_id, carrier.closure_id]
    .concat((carrier.evidence || []).map((edge) => edge.claim_evidence_id)).filter(Boolean);
  if (needles.length === 0) return true;
  const text = canonicalJson(trees || []);
  return needles.some((needle) => text.includes(needle));
}
function finalPeersForSource(resolved, sourcePeer, receipt, source) {
  // Rebuilding necessarily changes source occurrence/closure IDs. The
  // resolver retains the source generic key and exact operative assertion,
  // which is the stable, verified link back to the compiled candidate.
  const matches = (resolved || []).filter((row) => row?.generic_claim_key === sourcePeer.claim_definition_key
    && row?.section_reference === attrs(sourcePeer).section_reference
    && sameBase(sourcePeer, row?.claim)
    && sameOperativeAssertion(sourcePeer, row?.claim, receipt, source));
  return matches;
}
function resolvedPeerIsEligible(row, receipt, source) {
  const claim = row?.claim; const provision = row?.provision_instance; const party = row?.party;
  return TYPED_KEYS.has(claim?.claim_definition_key)
    && provision?.concept_key === 'DEF-MAE'
    && provision?.document_hash === receipt?.document_hash
    && source?.document_hash === receipt?.document_hash
    && claim?.state === 'PRESENT'
    && party?.role && party?.value && party?.capacity
    && party.value === attrs(claim).definition_subject
    && provision?.party?.role === party.role && provision?.party?.value === party.value
    && provision?.party?.capacity === party.capacity;
}
function record({ mode, disposition, reason, carrier, span, peers, receipt }) {
  const ids = peers.map((peer) => peer.claim.claim_revision_id).filter(Boolean).sort();
  const provisions = peers.map((peer) => peer.provision_instance.provision_instance_id).filter(Boolean).sort();
  const typedProvisionBindings = peers.map((peer) => ({
    claim_revision_id: peer.claim.claim_revision_id,
    resolved_provision_concept_key: peer.provision_instance.concept_key,
    resolved_provision_party_role: peer.provision_instance.party.role,
    resolved_provision_party_capacity: peer.provision_instance.party.capacity,
  })).sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right)));
  const identity = {
    document_hash: receipt.document_hash,
    section_family: 'MAE_DEFINITION',
    section_reference: attrs(carrier).section_reference,
    defined_term_ref: attrs(carrier).defined_term_ref,
    definition_subject: attrs(carrier).definition_subject,
    limb_path: rootPath(attrs(carrier).limb_path),
    operative_span: span,
    raw_value: carrier.raw_value,
    typed_provision_bindings: typedProvisionBindings,
    typed_claim_revision_ids: ids,
    provision_instance_ids: provisions,
  };
  return freeze({
    schema_version: DUPLICATE_SUPPRESSION_SCHEMA,
    mode,
    disposition,
    reason_code: reason,
    carrier_closure_id: carrier.closure_id,
    carrier_claim_occurrence_id: carrier.claim_occurrence_id,
    semantic_identity_digest: `sha256:${contentId(DUPLICATE_SUPPRESSION_SCHEMA, identity)}`,
    operative_span: span,
    surviving_typed_claim_revision_ids: ids,
    surviving_provision_instance_ids: provisions,
  });
}

function applyDuplicateSuppression({ mode = MODES.OFF, run_receipt: receipt, resolved = [], open_world: openWorld = [], limb_component_trees: trees = [], admitted_source_context: source } = {}) {
  if (!Object.values(MODES).includes(mode)) throw new TypeError('duplicate suppression mode must be OFF, REPORT_ONLY, or ENFORCE');
  if (mode === MODES.OFF) return Object.freeze({ open_world: openWorld, records: Object.freeze([]), counts: null });
  const index = sourceIndex(receipt); const records = []; const suppress = new Set();
  const carrierRows = openWorld.map((row, openWorldIndex) => ({ row, openWorldIndex }))
    .filter(({ row }) => row?.claim_definition_key === GENERIC_KEY)
    .map(({ row, openWorldIndex }) => {
      const matches = index.byClosure.get(row.closure_id) || [];
      return { row, openWorldIndex, match: matches.length === 1 ? matches[0] : null };
    })
    .filter(({ match }) => match && isMaeCarrier(match.entry, match.claim))
    .sort((left, right) => left.match.claim.closure_id.localeCompare(right.match.claim.closure_id));
  const outcomes = { scanned: carrierRows.length, would_suppress: 0, suppressed: 0, retained_typed_peer_held: 0, retained_no_typed_peer: 0 };
  for (const carrierRow of carrierRows) {
    const carrier = carrierRow.match.claim; const span = sourceSpanVerified({ claim: carrier, receipt, source });
    const basePeers = index.typed.filter((peer) => sameBase(carrier, peer.claim));
    const exactPeers = basePeers.filter((peer) => sameOperativeAssertion(carrier, peer.claim, receipt, source));
    let disposition = 'RETAINED'; let reason = 'SEMANTIC_IDENTITY_MISMATCH'; let survivors = [];
    if (!span || exactPeers.length !== basePeers.length && basePeers.some((peer) => !sourceSpanVerified({ claim: peer.claim, receipt, source }))) reason = 'OPERATIVE_SPAN_OR_QUOTE_UNVERIFIED';
    else if (basePeers.length === 0) { reason = 'NO_TYPED_PEER_FOR_OPERATIVE_SPAN'; outcomes.retained_no_typed_peer += 1; }
    else if (exactPeers.length === 0) { reason = 'NO_TYPED_PEER_FOR_OPERATIVE_SPAN'; outcomes.retained_no_typed_peer += 1; }
    else {
      const resolvedPeers = exactPeers.flatMap((peer) => finalPeersForSource(resolved, peer.claim, receipt, source));
      const uniqueResolvedPeers = [...new Map(resolvedPeers
        .map((peer) => [peer?.claim?.claim_revision_id, peer])
        .filter(([id]) => typeof id === 'string')).values()];
      const eligibleResolvedPeers = uniqueResolvedPeers.filter((peer) => resolvedPeerIsEligible(peer, receipt, source));
      if (uniqueResolvedPeers.length === 0) { reason = 'PARALLEL_TYPED_HELD'; outcomes.retained_typed_peer_held += 1; }
      else if (eligibleResolvedPeers.length === 0) reason = 'PARTY_OR_PROVISION_UNRESOLVED';
      else if (!eligibleResolvedPeers.every((peer) => equal(qualifierShape(carrier), qualifierShape(peer.claim)))) reason = 'QUALIFIER_SCOPE_DIFFERENT';
      else if (treeReferencesCarrier(trees, carrier)) reason = 'COMPONENT_TREE_REFERENCE_PRESENT';
      else {
        disposition = mode === MODES.ENFORCE ? 'SUPPRESSED' : 'WOULD_SUPPRESS';
        reason = 'SEMANTIC_DUPLICATE_WITH_RESOLVED_TYPED_MAE_CLAIM'; survivors = eligibleResolvedPeers;
        outcomes.would_suppress += 1;
        if (mode === MODES.ENFORCE) { outcomes.suppressed += 1; suppress.add(carrierRow.openWorldIndex); }
      }
    }
    records.push(record({ mode, disposition, reason, carrier, span, peers: survivors, receipt }));
  }
  const nextOpenWorld = mode === MODES.ENFORCE ? openWorld.filter((_row, indexValue) => !suppress.has(indexValue)) : openWorld;
  return freeze({ open_world: nextOpenWorld, records, counts: outcomes });
}

function duplicateSuppressionReceipt({ mode, result, run_receipt } = {}) {
  if (mode === MODES.OFF) return null;
  const counts = result?.counts;
  if (!counts || counts.scanned !== result.records.length) throw new TypeError('duplicate suppression record count mismatch');
  return freeze({
    schema_version: RECEIPT_SCHEMA, mode, ...counts,
    records_digest: `sha256:${contentId(DUPLICATE_SUPPRESSION_SCHEMA, result.records)}`,
    candidate_resolution_mapping_version: 'CANDIDATE_RESOLUTION/V1',
    run_receipt_id: run_receipt?.run_receipt_id || null,
    document_hash: run_receipt?.document_hash || null,
  });
}

module.exports = { DUPLICATE_SUPPRESSION_SCHEMA, RECEIPT_SCHEMA, MODES, applyDuplicateSuppression, duplicateSuppressionReceipt };
