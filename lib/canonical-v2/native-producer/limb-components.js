/**
 * lib/canonical-v2/native-producer/limb-components.js
 *
 * Mints the LIMB IDENTITY tree described in
 * docs/superpowers/specs/2026-08-01-claim-identity-provenance-design.md
 * section "1. Limb identity": a two-node model over a representation's
 * `limb_path` structure, minted deterministically from compiled candidates
 * -- never from model-supplied order, never with an invented span.
 *
 * WHY TWO NODE KINDS, NOT ONE. Real drafting reuses one limb marker for
 * several distinct assertions -- the F28 second-live-run recording carries
 * THREE separate assertions under bare `["(ii)"]` (a measurement-date
 * chapeau, a Disclosure-Letter list representation, and a subsidiary-shares
 * representation). A single component spanning the union of those three
 * assertions' evidence would conflate legally distinct representations
 * under one claim subject (2026-08-01 audit, finding A1 -- blocking). So
 * this module mints:
 *
 *  - PATH NODES -- one per distinct `limb_path`, structure only. Id is
 *    content-derived from (provision_instance_id, limb_path). Missing
 *    ancestors are minted mechanically so the tree is always connected. A
 *    path node's own `span` is always null: a real, byte-verified span
 *    belongs to an ASSERTION node, never to the structural node that groups
 *    them -- nothing here ever invents or unions a path-node span.
 *  - ASSERTION NODES -- one per compiled LIMB_ASSERTION proposal under that
 *    path, each with its own real, byte-verified `SEMANTIC_SPAN`-shaped
 *    span. Assertion nodes are the claim subjects. Ordinal is the
 *    assertion's rank among its siblings by (verified span start, span
 *    end), tie-broken by the hash of a whitespace-normalised quote --
 *    NEVER by producer emission order (round-2 audit, finding 3): two runs
 *    that emit the same assertions in different array order mint identical
 *    ids. (The tie-break hash here is a minimal, order-stabilising
 *    normalisation -- trim + collapsed whitespace + NFC -- not the full
 *    zero-width/marker normalisation that ships with Task 2's qualifier-kind
 *    lexicon; this stage only needs a stable string to break exact-span
 *    ties, not legal-semantic equivalence.)
 *
 * QUALIFIER ATTACHMENT (spec's five tree rules, round-2 audit finding 4):
 * `resolveQualifierAttachment` maps a qualifier's `governs_path` onto this
 * tree. Ambiguity counts ASSERTION children only -- a path node's own
 * structural (path-node) children never make an attachment ambiguous.
 * Exactly one assertion child -> the qualifier attaches to it directly.
 * Multiple assertion children -> the qualifier attaches to the PATH node
 * with a typed `ASSERTION_SCOPE_AMBIGUOUS` reason, auto-pass blocked, and
 * scope flow-down SUSPENDED until a human review outcome of
 * `GOVERNS_WHOLE_NODE` explicitly enables it. Zero assertion children (a
 * pure structural node over sub-limbs) -> the qualifier is a chapeau of
 * that node: it attaches to the path node and flow-down is enabled
 * immediately, no review needed.
 *
 * SCOPE TRAVERSAL. `traverseGovernedScope` walks the parent links from an
 * attachment's subject down to every descendant component it governs,
 * respecting the suspension rule above: an ambiguous, unruled attachment
 * governs nothing via traversal. Once GOVERNS_WHOLE_NODE is ruled, "the
 * whole node" is read literally: flow-down reaches EVERY direct child of
 * the path node -- including the very assertion children whose plurality
 * made the attachment ambiguous in the first place -- plus their own
 * descendants, not just the sibling structural sub-limbs.
 *
 * STANDALONE AND PURE. This module takes compiled candidates in the exact
 * shape `native-extraction-run.js` produces on `run_receipt.compiled_
 * candidates` (see candidate-resolution.js's own top-of-file handling for
 * that shape: `{ ok, candidate: { kind: 'claim', claim, extraction_
 * provenance }, ... }`, where `claim.attributes.limb_path` /
 * `claim.attributes.attachment` and `claim.evidence[].absolute_start/
 * absolute_end` are the fields this module reads) plus a
 * `provision_instance_id` the caller already minted. It performs no I/O and
 * no model calls itself. It IS wired into candidate-resolution.js (that
 * integration, deferred when this header was first written, has since
 * landed: `mintLimbComponentTree` and this module's own
 * `resolveQualifierAttachment` are both called from there) and into
 * `semantic-safety-preflight.js`; check those call sites, not this
 * sentence, before assuming any particular caller. Every output is frozen.
 * Content-id derivation follows the existing `contentId(domain, payload)`
 * convention with new `/V1` domain strings, per the spec's "Pinned
 * implementation decisions".
 *
 * NAME COLLISION TRAP: this module's own `resolveQualifierAttachment`
 * (tree, {governs_path, review_outcome}) -- which tree NODE a qualifier
 * attaches to -- shares its exported name with, but is NOT the same
 * function as, `qualifier-attachment.js`'s `resolveQualifierAttachment`
 * ({position, governs_path, quote_text, ...}) -- what SCOPE a qualifier's
 * own text implies. `anthropic-provider.js` imports the latter;
 * `candidate-resolution.js` and `semantic-safety-preflight.js` import the
 * former. Never assume which one a bare `resolveQualifierAttachment` import
 * is without checking its `require(...)` path.
 */

'use strict';

const { contentId, sha256Hex } = require('../canonical-bytes');
const { LIMB_ASSERTION_CLAIM_KEY, QUALIFIER_CLAIM_KEY } = require('./anthropic-provider');

const PATH_COMPONENT_DOMAIN = 'LIMB_PATH_COMPONENT/V1';
const ASSERTION_COMPONENT_DOMAIN = 'LIMB_ASSERTION_COMPONENT/V1';
const LIMB_COMPONENT_TREE_SCHEMA = 'LIMB_COMPONENT_TREE/V1';

const REVIEW_OUTCOMES = Object.freeze(['GOVERNS_WHOLE_NODE']);

/**
 * A typed, fail-closed error -- every field the caller needs is on the
 * instance, never just a message string to parse (house convention, see
 * candidate-resolution.js's own CandidateResolutionError / anthropic-
 * provider.js's NativeProducerAnthropicError).
 */
class LimbComponentError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'LimbComponentError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new LimbComponentError(code, message, details);
}

function requireArray(value, label) {
  if (!Array.isArray(value)) fail('INVALID_INPUT', `${label} must be an array`);
  return value;
}

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    fail('INVALID_INPUT', `${label} must be a non-empty string`);
  }
  return value;
}

function isNonEmptyLimbPath(value) {
  return Array.isArray(value) && value.length > 0
    && value.every((label) => typeof label === 'string' && label.length > 0);
}

function limbPathKey(limbPath) {
  return JSON.stringify(limbPath);
}

function parentPathOf(limbPath) {
  return limbPath.length <= 1 ? null : limbPath.slice(0, -1);
}

function pathStartsWith(path, prefix) {
  if (path.length < prefix.length) return false;
  for (let i = 0; i < prefix.length; i += 1) {
    if (path[i] !== prefix[i]) return false;
  }
  return true;
}

// Minimal, order-stabilising normalisation used ONLY to break exact
// (start, end) ties deterministically. Not the full zero-width/marker
// normalisation of Task 2's qualifier-kind lexicon -- see file header.
function normaliseQuoteForTiebreak(quote) {
  return String(quote).normalize('NFC').trim().replace(/\s+/g, ' ');
}

function compareByHash(hashA, hashB) {
  if (hashA === hashB) return 0;
  return hashA < hashB ? -1 : 1;
}

// ---------------------------------------------------------------------------
// Extracting the two relevant candidate families from a compiled-candidates
// list. Everything else (bring-down tiers, open-world candidates, rejected
// entries) is simply not this module's concern.
// ---------------------------------------------------------------------------

function isOkClaimCandidate(entry) {
  return Boolean(entry) && entry.ok === true
    && entry.candidate && entry.candidate.kind === 'claim'
    && entry.candidate.claim && typeof entry.candidate.claim === 'object';
}

function extractAssertionClaims(compiledCandidates) {
  const out = [];
  for (const entry of compiledCandidates) {
    if (!isOkClaimCandidate(entry)) continue;
    const claim = entry.candidate.claim;
    if (claim.claim_definition_key !== LIMB_ASSERTION_CLAIM_KEY) continue;
    out.push(claim);
  }
  return out;
}

function extractQualifierClaims(compiledCandidates) {
  const out = [];
  for (const entry of compiledCandidates) {
    if (!isOkClaimCandidate(entry)) continue;
    const claim = entry.candidate.claim;
    if (claim.claim_definition_key !== QUALIFIER_CLAIM_KEY) continue;
    out.push(claim);
  }
  return out;
}

function operativeEvidenceOf(claim) {
  if (!Array.isArray(claim.evidence) || claim.evidence.length === 0) return null;
  const operative = claim.evidence.find((edge) => edge.evidence_role === 'OPERATIVE_TEXT');
  return operative || claim.evidence[0];
}

// ---------------------------------------------------------------------------
// Tree minting.
// ---------------------------------------------------------------------------

/**
 * Mints the frozen two-node limb component tree for one provision instance.
 *
 * @param {object} args
 * @param {object[]} args.compiled_candidates  the run receipt's compiled
 *   candidates, in the exact shape native-extraction-run.js produces
 *   (`{ ok, candidate: { kind, claim, extraction_provenance }, ... }`).
 * @param {string} args.provision_instance_id  the already-minted
 *   PROVISION_INSTANCE/V1 id this tree's components belong under.
 * @returns {{
 *   schema_version: string,
 *   provision_instance_id: string,
 *   path_nodes: object[],
 *   assertion_nodes: object[],
 *   nodes_by_id: object,
 *   path_node_id_by_limb_path: object,
 *   residuals: object[],
 * }}
 */
function mintLimbComponentTree({
  compiled_candidates: compiledCandidates,
  provision_instance_id: provisionInstanceId,
} = {}) {
  requireArray(compiledCandidates, 'compiled_candidates');
  requireNonEmptyString(provisionInstanceId, 'provision_instance_id');

  const residuals = [];

  // groups: limb_path key -> { limb_path, assertions: [{claim, quote, absolute_start, absolute_end}] }
  const groups = new Map();

  function groupFor(limbPath) {
    const key = limbPathKey(limbPath);
    let group = groups.get(key);
    if (!group) {
      group = { limb_path: limbPath, assertions: [] };
      groups.set(key, group);
    }
    return group;
  }

  for (const claim of extractAssertionClaims(compiledCandidates)) {
    const limbPath = claim.attributes && claim.attributes.limb_path;
    if (!isNonEmptyLimbPath(limbPath)) {
      residuals.push(Object.freeze({
        residual_type: 'LIMB_ASSERTION_MISSING_LIMB_PATH',
        claim_occurrence_id: claim.claim_occurrence_id || null,
      }));
      continue;
    }
    const evidence = operativeEvidenceOf(claim);
    if (!evidence
      || !Number.isInteger(evidence.absolute_start)
      || !Number.isInteger(evidence.absolute_end)) {
      residuals.push(Object.freeze({
        residual_type: 'LIMB_ASSERTION_MISSING_EVIDENCE',
        claim_occurrence_id: claim.claim_occurrence_id || null,
      }));
      continue;
    }
    groupFor(limbPath).assertions.push({
      claim,
      quote: claim.raw_value,
      absolute_start: evidence.absolute_start,
      absolute_end: evidence.absolute_end,
    });
  }

  // Mint missing ancestors mechanically -- a path node with no assertions of
  // its own (a pure structural node) still needs to exist so its children
  // have somewhere to attach.
  for (const key of [...groups.keys()]) {
    let parent = parentPathOf(groups.get(key).limb_path);
    while (parent) {
      groupFor(parent); // no-op if it already exists
      parent = parentPathOf(parent);
    }
  }

  // Deterministic ordering. Ties (or nodes with no evidence anywhere in
  // their subtree) break on the hash of the path's own label, never on
  // input array order -- so minting is invariant to the order compiled
  // candidates arrived in.
  function subtreeMinStart(limbPath) {
    let min = Infinity;
    for (const group of groups.values()) {
      if (!pathStartsWith(group.limb_path, limbPath)) continue;
      for (const assertion of group.assertions) {
        if (assertion.absolute_start < min) min = assertion.absolute_start;
      }
    }
    return min;
  }

  function sortKeyFor(limbPath) {
    return [subtreeMinStart(limbPath), sha256Hex(limbPathKey(limbPath))];
  }

  const childrenKeysByParentKey = new Map(); // parentKey ('' for root) -> [pathKey, ...]
  for (const [key, group] of groups) {
    const parent = parentPathOf(group.limb_path);
    const parentKey = parent ? limbPathKey(parent) : '';
    if (!childrenKeysByParentKey.has(parentKey)) childrenKeysByParentKey.set(parentKey, []);
    childrenKeysByParentKey.get(parentKey).push(key);
  }
  for (const keys of childrenKeysByParentKey.values()) {
    keys.sort((a, b) => {
      const [minA, hashA] = sortKeyFor(groups.get(a).limb_path);
      const [minB, hashB] = sortKeyFor(groups.get(b).limb_path);
      if (minA !== minB) return minA - minB;
      return compareByHash(hashA, hashB);
    });
  }

  // Mint path node ids up front so parent/child references can resolve
  // regardless of minting order.
  const pathNodeIdByKey = new Map();
  for (const [key, group] of groups) {
    pathNodeIdByKey.set(key, contentId(PATH_COMPONENT_DOMAIN, {
      provision_instance_id: provisionInstanceId,
      limb_path: group.limb_path,
    }));
  }

  const pathNodes = [];
  for (const keys of childrenKeysByParentKey.values()) {
    keys.forEach((key, ordinal) => {
      const group = groups.get(key);
      const parentPath = parentPathOf(group.limb_path);
      pathNodes.push(Object.freeze({
        limb_component_id: pathNodeIdByKey.get(key),
        component_kind: 'PATH',
        provision_instance_id: provisionInstanceId,
        limb_path: Object.freeze([...group.limb_path]),
        parent_limb_component_id: parentPath ? pathNodeIdByKey.get(limbPathKey(parentPath)) : null,
        ordinal_under_parent: ordinal,
        span: null,
      }));
    });
  }

  // Assertion nodes: ranked among siblings by (verified span start, span
  // end), tie-broken by the hash of the normalised quote -- never by input
  // array order (round-2 audit, finding 3).
  const assertionNodes = [];
  for (const [key, group] of groups) {
    const pathNodeId = pathNodeIdByKey.get(key);
    const ranked = [...group.assertions].sort((a, b) => {
      if (a.absolute_start !== b.absolute_start) return a.absolute_start - b.absolute_start;
      if (a.absolute_end !== b.absolute_end) return a.absolute_end - b.absolute_end;
      return compareByHash(
        sha256Hex(normaliseQuoteForTiebreak(a.quote)),
        sha256Hex(normaliseQuoteForTiebreak(b.quote)),
      );
    });
    ranked.forEach((assertion, ordinal) => {
      const id = contentId(ASSERTION_COMPONENT_DOMAIN, {
        path_limb_component_id: pathNodeId,
        ordinal,
      });
      assertionNodes.push(Object.freeze({
        limb_component_id: id,
        component_kind: 'ASSERTION',
        provision_instance_id: provisionInstanceId,
        limb_path: Object.freeze([...group.limb_path]),
        parent_limb_component_id: pathNodeId,
        ordinal_under_parent: ordinal,
        span: Object.freeze({
          absolute_start: assertion.absolute_start,
          absolute_end: assertion.absolute_end,
        }),
        quote: assertion.quote,
        claim_occurrence_id: assertion.claim.claim_occurrence_id || null,
      }));
    });
  }

  const nodesById = {};
  for (const node of pathNodes) nodesById[node.limb_component_id] = node;
  for (const node of assertionNodes) nodesById[node.limb_component_id] = node;

  const pathNodeIdByLimbPath = {};
  for (const [key, id] of pathNodeIdByKey) pathNodeIdByLimbPath[key] = id;

  return Object.freeze({
    schema_version: LIMB_COMPONENT_TREE_SCHEMA,
    provision_instance_id: provisionInstanceId,
    path_nodes: Object.freeze(pathNodes),
    assertion_nodes: Object.freeze(assertionNodes),
    nodes_by_id: Object.freeze(nodesById),
    path_node_id_by_limb_path: Object.freeze(pathNodeIdByLimbPath),
    residuals: Object.freeze(residuals),
  });
}

// ---------------------------------------------------------------------------
// Qualifier attachment resolution -- the spec's five tree rules.
// ---------------------------------------------------------------------------

/**
 * Resolves where, in an already-minted tree, a qualifier whose attachment
 * position is ITEM or TRAILING-with-a-resolved-path (i.e. carries a real
 * `governs_path`) actually attaches. A CHAPEAU qualifier (governs_path
 * null) is a representation-level attachment and never reaches this
 * function -- it is outside the limb tree entirely.
 *
 * @param {object} tree            the frozen tree from mintLimbComponentTree
 * @param {object} args
 * @param {string[]} args.governs_path      the qualifier's target limb_path
 * @param {string|null} [args.review_outcome] `GOVERNS_WHOLE_NODE` if a human
 *   has ruled that an ambiguous attachment deliberately governs the whole
 *   node -- enables flow-down on that ruling; null/absent otherwise.
 * @returns {{
 *   attached: boolean,
 *   subject_component_id: (string|null),
 *   node_kind: ('ASSERTION'|'PATH'|null),
 *   reasons: string[],
 *   auto_pass_blocked: boolean,
 *   flow_down_enabled: boolean,
 *   review_outcome: (string|null),
 * }}
 */
function resolveQualifierAttachment(tree, {
  governs_path: governsPath,
  review_outcome: reviewOutcome = null,
} = {}) {
  if (!tree || typeof tree !== 'object' || tree.schema_version !== LIMB_COMPONENT_TREE_SCHEMA) {
    fail('INVALID_INPUT', 'tree must be a mintLimbComponentTree() result');
  }
  if (!isNonEmptyLimbPath(governsPath)) {
    fail('INVALID_INPUT', 'governs_path must be a non-empty limb_path array -- a CHAPEAU '
      + 'qualifier (governs_path null) attaches at the provision level, outside this tree');
  }
  if (reviewOutcome != null && !REVIEW_OUTCOMES.includes(reviewOutcome)) {
    fail('INVALID_INPUT', `unsupported review_outcome: ${reviewOutcome}`, { allowed: REVIEW_OUTCOMES });
  }

  const pathNodeId = tree.path_node_id_by_limb_path[limbPathKey(governsPath)];
  if (!pathNodeId) {
    return Object.freeze({
      attached: false,
      subject_component_id: null,
      node_kind: null,
      reasons: Object.freeze(['LIMB_PATH_NOT_IN_TREE']),
      auto_pass_blocked: true,
      flow_down_enabled: false,
      review_outcome: reviewOutcome,
    });
  }

  // Ambiguity counts ASSERTION children only -- path-node children never
  // make an attachment ambiguous.
  const assertionChildren = tree.assertion_nodes.filter(
    (node) => node.parent_limb_component_id === pathNodeId,
  );

  if (assertionChildren.length === 1) {
    return Object.freeze({
      attached: true,
      subject_component_id: assertionChildren[0].limb_component_id,
      node_kind: 'ASSERTION',
      reasons: Object.freeze([]),
      auto_pass_blocked: false,
      flow_down_enabled: false,
      review_outcome: reviewOutcome,
    });
  }

  if (assertionChildren.length > 1) {
    // Multiple assertion children -> attach to the PATH node itself,
    // typed-ambiguous, auto-pass blocked. Flow-down stays suspended unless
    // a human has ruled GOVERNS_WHOLE_NODE.
    return Object.freeze({
      attached: true,
      subject_component_id: pathNodeId,
      node_kind: 'PATH',
      reasons: Object.freeze(['ASSERTION_SCOPE_AMBIGUOUS']),
      auto_pass_blocked: true,
      flow_down_enabled: reviewOutcome === 'GOVERNS_WHOLE_NODE',
      review_outcome: reviewOutcome,
    });
  }

  // Zero assertion children: a pure structural node over sub-limbs. The
  // qualifier is a chapeau of that node -- it attaches to the path node and
  // scope flows down to descendants immediately, no review needed.
  return Object.freeze({
    attached: true,
    subject_component_id: pathNodeId,
    node_kind: 'PATH',
    reasons: Object.freeze([]),
    auto_pass_blocked: false,
    flow_down_enabled: true,
    review_outcome: reviewOutcome,
  });
}

// ---------------------------------------------------------------------------
// Scope traversal.
// ---------------------------------------------------------------------------

/**
 * Walks the tree from a resolved attachment down to every descendant
 * component it governs, respecting the suspension rule: an ambiguous,
 * unruled attachment governs nothing via traversal. An attachment on an
 * ASSERTION node governs only itself (assertion nodes have no children in
 * this two-node model). Returns component ids in breadth-first,
 * deterministic (ordinal-sorted) order.
 *
 * @param {object} tree        the frozen tree from mintLimbComponentTree
 * @param {object} attachment  the frozen result of resolveQualifierAttachment
 * @returns {string[]} frozen array of governed limb_component_ids
 */
function traverseGovernedScope(tree, attachment) {
  if (!tree || typeof tree !== 'object' || tree.schema_version !== LIMB_COMPONENT_TREE_SCHEMA) {
    fail('INVALID_INPUT', 'tree must be a mintLimbComponentTree() result');
  }
  if (!attachment || attachment.attached !== true) return Object.freeze([]);
  if (attachment.node_kind === 'ASSERTION') {
    return Object.freeze([attachment.subject_component_id]);
  }
  if (!attachment.flow_down_enabled) return Object.freeze([]);

  const childrenByParentId = new Map();
  const allNodes = [...tree.path_nodes, ...tree.assertion_nodes]
    .slice()
    .sort((a, b) => a.ordinal_under_parent - b.ordinal_under_parent);
  for (const node of allNodes) {
    const parentId = node.parent_limb_component_id;
    if (!childrenByParentId.has(parentId)) childrenByParentId.set(parentId, []);
    childrenByParentId.get(parentId).push(node.limb_component_id);
  }

  const governed = [];
  const queue = [...(childrenByParentId.get(attachment.subject_component_id) || [])];
  while (queue.length > 0) {
    const id = queue.shift();
    governed.push(id);
    const kids = childrenByParentId.get(id);
    if (kids) queue.push(...kids);
  }
  return Object.freeze(governed);
}

module.exports = {
  LimbComponentError,
  mintLimbComponentTree,
  resolveQualifierAttachment,
  traverseGovernedScope,
  limbPathKey,
};
