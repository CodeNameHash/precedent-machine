'use strict';

/**
 * Q-0015: party-identity census for the ten Work 3 agreements and the
 * frozen 50 review items.
 *
 * Paths come from Work 3 set members (index / context / analysis). M2 and
 * M3 artefacts are opened only here. Party spans are annotation or fact
 * spans already present on those artefacts; none are invented. SHA-256 is
 * sha256Hex of the UTF-8 half-open byte slice.
 */

import { createRequire } from 'node:module';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { repoRootFrom } from './repo-root.mjs';

const repoRoot = repoRootFrom(import.meta.url);
const require = createRequire(resolve(repoRoot, 'package.json'));
const { sha256Hex } = require(resolve(repoRoot, 'lib/canonical-v2/canonical-bytes.js'));

const OUT_DIR = dirname(new URL(import.meta.url).pathname);
const IDENTITY_PATH = resolve(
  repoRoot,
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-fixed-sample-identity-manifest.json',
);
const INDEX_SET_PATH = resolve(
  repoRoot,
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work3-agreement-index-set.json',
);
const CONTEXT_SET_PATH = resolve(
  repoRoot,
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work3-context-compilation-set.json',
);
const ANALYSIS_SET_PATH = resolve(
  repoRoot,
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work3-agreement-analysis-set.json',
);
const CLOSURES_PATH = resolve(OUT_DIR, '12-fixed50-source-closures.json');

const SEED_PARTY_TERMS = Object.freeze([
  'Parent',
  'Company',
  'Merger Sub',
  'Purchaser',
  'Buyer',
  'Guarantor',
]);

const FIELD_CITES = Object.freeze({
  m4_legacy_party: {
    path: 'lib/canonical-v2/agreement-analysis.js',
    line: 668,
    assignment_line: 647,
    text: 'legacy_party: legacyParty,',
    assignment_text: 'const legacyParty = clone(resolvedRecord.party ?? resolvedRecord.provision_instance?.party ?? null);',
  },
  m4_legacy_party_null: {
    path: 'lib/canonical-v2/agreement-analysis.js',
    line: 1054,
    text: 'legacy_party: null,',
  },
  resolver_party_source_span: {
    path: 'lib/canonical-v2/native-producer/candidate-resolution.js',
    line: 6209,
    text: 'party_source_span: partySourceSpan,',
  },
  v2_bound_entity_gate: {
    path: 'lib/canonical-v2/m7-v2-deterministic-generator.js',
    line: 391,
    text: "|| relationship.relationship_type !== 'BOUND_ENTITY'",
  },
});

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function rel(path) {
  return relative(repoRoot, path).split('\\').join('/');
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortedObject(value) {
  if (Array.isArray(value)) return value.map(sortedObject);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort(compareText)) {
      out[key] = sortedObject(value[key]);
    }
    return out;
  }
  return value;
}

function bump(map, key, n = 1) {
  map.set(key, (map.get(key) ?? 0) + n);
}

function mapToSortedObject(map) {
  const out = {};
  for (const key of [...map.keys()].sort(compareText)) out[key] = map.get(key);
  return out;
}

function completeSpan(span) {
  if (!span || typeof span !== 'object') return null;
  const start = Number.isInteger(span.start_byte) ? span.start_byte : null;
  const end = Number.isInteger(span.end_byte) ? span.end_byte : null;
  if (start === null || end === null || start < 0 || end < start) return null;
  return {
    start_byte: start,
    end_byte: end,
    text_sha256: typeof span.text_sha256 === 'string' ? span.text_sha256 : null,
  };
}

function hashSpan(canonicalBytes, start, end) {
  if (!canonicalBytes || !Number.isInteger(start) || !Number.isInteger(end)) return null;
  if (start < 0 || end < start || end > canonicalBytes.length) return null;
  return sha256Hex(canonicalBytes.subarray(start, end));
}

function verifyReportedSpan(canonicalBytes, span) {
  const complete = completeSpan(span);
  if (!complete) {
    return {
      start_byte: span?.start_byte ?? null,
      end_byte: span?.end_byte ?? null,
      text_sha256: typeof span?.text_sha256 === 'string' ? span.text_sha256 : null,
      verified: false,
    };
  }
  const hashed = hashSpan(canonicalBytes, complete.start_byte, complete.end_byte);
  if (hashed === null) {
    return { ...complete, text_sha256: complete.text_sha256, verified: false };
  }
  return {
    start_byte: complete.start_byte,
    end_byte: complete.end_byte,
    text_sha256: hashed,
    verified: true,
  };
}

function spanInside(inner, outer) {
  return Number.isInteger(inner?.start_byte)
    && Number.isInteger(inner?.end_byte)
    && Number.isInteger(outer?.start_byte)
    && Number.isInteger(outer?.end_byte)
    && inner.start_byte >= outer.start_byte
    && inner.end_byte <= outer.end_byte;
}

function partySpanFromClaim(claim) {
  const revision = claim?.legacy_claim_revision && typeof claim.legacy_claim_revision === 'object'
    ? claim.legacy_claim_revision
    : null;
  const party = claim?.legacy_party && typeof claim.legacy_party === 'object'
    ? claim.legacy_party
    : null;
  const candidates = [
    revision?.party_source_span,
    revision?.party_span,
    claim?.party_source_span,
    party?.party_source_span,
    party?.source_span,
    party?.span,
  ];
  for (const candidate of candidates) {
    const complete = completeSpan(candidate);
    if (complete) return complete;
  }
  return null;
}

function hasLegacyParty(claim) {
  return claim?.legacy_party != null;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function valueNamesPartyTerm(value, terms) {
  if (typeof value !== 'string' || value.length === 0 || terms.length === 0) return [];
  const hits = [];
  for (const term of terms) {
    const pattern = new RegExp(`\\b${escapeRegex(term)}\\b`);
    if (pattern.test(value)) hits.push(term);
  }
  return hits;
}

function closureUsableSpan(record) {
  if (!record || record.source === 'UNRESOLVED') return null;
  if (!Number.isInteger(record.start_byte) || !Number.isInteger(record.end_byte)) return null;
  return {
    start_byte: record.start_byte,
    end_byte: record.end_byte,
    text_sha256: record.text_sha256 ?? null,
    source: record.source ?? null,
    node_occurrence_id: record.node_occurrence_id ?? null,
  };
}

function loadMemberPath(memberPath, missingPaths, label) {
  if (typeof memberPath !== 'string' || memberPath.length === 0) {
    missingPaths.push(`${label} missing path`);
    return null;
  }
  const abs = resolve(repoRoot, memberPath);
  if (!existsSync(abs)) {
    missingPaths.push(memberPath);
    return null;
  }
  return { path: memberPath, record: loadJson(abs) };
}

function extractPreambleWindow(nodes) {
  const agreement = nodes.find((node) => node.node_kind === 'AGREEMENT') ?? null;
  const articles = nodes
    .filter((node) => node.node_kind === 'ARTICLE')
    .sort((left, right) => (left.extent_span?.start_byte ?? 0) - (right.extent_span?.start_byte ?? 0));
  const firstArticleStart = articles[0]?.extent_span?.start_byte ?? null;
  const preambleNodes = nodes.filter((node) => {
    if (node.node_kind === 'AGREEMENT' || node.node_kind === 'ARTICLE') return false;
    if (agreement && node.parent_node_occurrence_id !== agreement.node_occurrence_id) return false;
    if (!Number.isInteger(node.extent_span?.start_byte)) return false;
    if (Number.isInteger(firstArticleStart) && node.extent_span.start_byte >= firstArticleStart) {
      return false;
    }
    return true;
  });
  const start = preambleNodes.length > 0
    ? Math.min(...preambleNodes.map((node) => node.extent_span.start_byte))
    : 0;
  const end = Number.isInteger(firstArticleStart)
    ? firstArticleStart
    : (preambleNodes.length > 0
      ? Math.max(...preambleNodes.map((node) => node.extent_span.end_byte))
      : 0);
  return {
    start_byte: start,
    end_byte: end,
    node_occurrence_ids: preambleNodes
      .map((node) => node.node_occurrence_id)
      .filter((id) => typeof id === 'string')
      .sort(compareText),
    node_count: preambleNodes.length,
    first_article_start_byte: firstArticleStart,
  };
}

function censusM4(claims) {
  let withParty = 0;
  let withSpan = 0;
  let withNeither = 0;
  const roles = new Map();
  const capacities = new Map();
  for (const claim of claims) {
    const party = hasLegacyParty(claim);
    const span = partySpanFromClaim(claim);
    if (party) {
      withParty += 1;
      bump(roles, claim.legacy_party?.role ?? '(no role)');
      bump(capacities, claim.legacy_party?.capacity ?? '(no capacity)');
    }
    if (span) withSpan += 1;
    if (!party && !span) withNeither += 1;
  }
  return {
    claim_count: claims.length,
    with_party: withParty,
    with_span: withSpan,
    with_neither: withNeither,
    party_roles: mapToSortedObject(roles),
    party_capacities: mapToSortedObject(capacities),
  };
}

function censusM2(indexRecord, missingPaths) {
  const agreementId = indexRecord?.source_binding?.agreement_id;
  const canonicalText = indexRecord?.source_binding?.canonical_text;
  const canonicalBytes = typeof canonicalText === 'string'
    ? Buffer.from(canonicalText, 'utf8')
    : null;
  if (!canonicalBytes) {
    missingPaths.push(`m2 ${agreementId ?? '?'} missing source_binding.canonical_text`);
  }
  const nodes = Array.isArray(indexRecord?.nodes) ? indexRecord.nodes : [];
  const annotations = Array.isArray(indexRecord?.annotations) ? indexRecord.annotations : [];
  const preamble = extractPreambleWindow(nodes);
  const preambleSpan = { start_byte: preamble.start_byte, end_byte: preamble.end_byte };

  const preambleTerms = new Set();
  const definitionsByTerm = new Map();
  const usesByTerm = new Map();
  const annotationKinds = new Map();

  for (const annotation of annotations) {
    bump(annotationKinds, annotation?.annotation_kind ?? '(missing)');
    const value = typeof annotation?.value === 'string' ? annotation.value : null;
    const span = verifyReportedSpan(canonicalBytes, annotation?.span);
    if (annotation?.annotation_kind === 'DEFINED_TERM_DEFINITION' && value) {
      const list = definitionsByTerm.get(value) ?? [];
      list.push({
        annotation_occurrence_id: annotation.annotation_occurrence_id ?? null,
        owner_node_occurrence_id: annotation.owner_node_occurrence_id ?? null,
        in_preamble: spanInside(span, preambleSpan),
        span,
      });
      definitionsByTerm.set(value, list);
      if (spanInside(span, preambleSpan)) preambleTerms.add(value);
    }
    if (annotation?.annotation_kind === 'DEFINED_TERM_USE' && value) {
      const list = usesByTerm.get(value) ?? [];
      list.push({
        annotation_occurrence_id: annotation.annotation_occurrence_id ?? null,
        owner_node_occurrence_id: annotation.owner_node_occurrence_id ?? null,
        span,
      });
      usesByTerm.set(value, list);
    }
  }

  const partyTerms = [...new Set([...SEED_PARTY_TERMS, ...preambleTerms])].sort(compareText);
  const termRows = partyTerms.map((term) => {
    const definitions = (definitionsByTerm.get(term) ?? [])
      .map((entry) => ({
        annotation_occurrence_id: entry.annotation_occurrence_id,
        in_preamble: entry.in_preamble,
        owner_node_occurrence_id: entry.owner_node_occurrence_id,
        span: entry.span,
      }))
      .sort((left, right) => {
        const start = (left.span.start_byte ?? 0) - (right.span.start_byte ?? 0);
        if (start !== 0) return start;
        return compareText(
          left.annotation_occurrence_id ?? '',
          right.annotation_occurrence_id ?? '',
        );
      });
    const uses = usesByTerm.get(term) ?? [];
    return {
      definition_count: definitions.length,
      definition_spans: definitions,
      in_seed: SEED_PARTY_TERMS.includes(term),
      preamble_defined: preambleTerms.has(term),
      term,
      use_count: uses.length,
    };
  });

  const partyUses = [];
  for (const term of partyTerms) {
    for (const use of usesByTerm.get(term) ?? []) {
      partyUses.push({ term, ...use });
    }
  }

  return {
    agreement_id: typeof agreementId === 'string' ? agreementId : null,
    annotation_kinds: mapToSortedObject(annotationKinds),
    canonical_bytes: canonicalBytes,
    party_terms: termRows,
    party_term_names: partyTerms,
    party_uses: partyUses,
    preamble,
    preamble_defined_terms: [...preambleTerms].sort(compareText),
    sha_mismatch_definition_spans: termRows.reduce(
      (sum, row) => sum + row.definition_spans.filter((entry) => !entry.span.verified).length,
      0,
    ),
  };
}

function censusM3(contextRecord, partyTerms) {
  const facts = Array.isArray(contextRecord?.context_facts) ? contextRecord.context_facts : [];
  const relationships = Array.isArray(contextRecord?.semantic_relationships)
    ? contextRecord.semantic_relationships
    : [];
  const roles = new Map();
  const capacityValues = new Map();
  const partyNamingByRole = new Map();
  const slimCapacity = [];
  const slimPartyFacts = [];

  for (const fact of facts) {
    const role = typeof fact?.role === 'string' ? fact.role : '(missing)';
    bump(roles, role);
    const named = valueNamesPartyTerm(fact?.value, partyTerms);
    if (role === 'CAPACITY') {
      bump(capacityValues, typeof fact.value === 'string' ? fact.value : '(non-string)');
      slimCapacity.push({
        named_party_terms: named,
        role,
        source_node_occurrence_id: fact.source_node_occurrence_id ?? null,
        source_span: completeSpan(fact.source_span),
        state: fact.state ?? null,
        target_node_occurrence_id: fact.target_node_occurrence_id ?? null,
        value: typeof fact.value === 'string' ? fact.value : null,
      });
    }
    if (named.length > 0) {
      bump(partyNamingByRole, role);
      slimPartyFacts.push({
        named_party_terms: named,
        role,
        source_node_occurrence_id: fact.source_node_occurrence_id ?? null,
        source_span: completeSpan(fact.source_span),
        state: fact.state ?? null,
        target_node_occurrence_id: fact.target_node_occurrence_id ?? null,
        value: typeof fact.value === 'string' ? fact.value : null,
      });
    }
  }

  const relationshipKinds = new Map();
  const relationshipStates = new Map();
  const slimRelationships = [];
  for (const relationship of relationships) {
    const kind = typeof relationship?.relationship_type === 'string'
      ? relationship.relationship_type
      : '(missing)';
    bump(relationshipKinds, kind);
    bump(relationshipStates, `${kind}:${relationship?.state ?? '(no state)'}`);
    slimRelationships.push({
      relationship_type: kind,
      source_endpoint_label: relationship.source_endpoint?.canonical_label ?? null,
      source_node_occurrence_id: relationship.source_endpoint?.source_node_occurrence_id ?? null,
      source_node_occurrence_ids: Array.isArray(relationship.source_node_occurrence_ids)
        ? relationship.source_node_occurrence_ids
        : [],
      state: relationship.state ?? null,
      target_endpoint_label: relationship.target_endpoint?.canonical_label ?? null,
      target_node_occurrence_id: relationship.target_endpoint?.source_node_occurrence_id ?? null,
      target_span: completeSpan(relationship.target_endpoint?.source_span),
    });
  }

  return {
    capacity_facts: slimCapacity,
    capacity_value_counts: mapToSortedObject(capacityValues),
    fact_count: facts.length,
    fact_roles: mapToSortedObject(roles),
    party_naming_facts: slimPartyFacts,
    party_naming_facts_by_role: mapToSortedObject(partyNamingByRole),
    relationship_count: relationships.length,
    relationship_kinds: mapToSortedObject(relationshipKinds),
    relationship_kind_states: mapToSortedObject(relationshipStates),
    relationships: slimRelationships,
  };
}

function intersectingClaims(claims, itemNodes) {
  if (itemNodes.size === 0) return [];
  const hits = [];
  for (const claim of claims) {
    const claimNodes = Array.isArray(claim.source_node_occurrence_ids)
      ? claim.source_node_occurrence_ids
      : [];
    if (!claimNodes.some((id) => itemNodes.has(id))) continue;
    hits.push(claim);
  }
  hits.sort((left, right) => {
    const keyCmp = compareText(left.claim_definition_key ?? '', right.claim_definition_key ?? '');
    if (keyCmp !== 0) return keyCmp;
    return compareText(left.analysis_claim_id ?? '', right.analysis_claim_id ?? '');
  });
  return hits;
}

function factAttachesToItem(fact, itemNodes, nodeSpan) {
  if (typeof fact.target_node_occurrence_id === 'string' && itemNodes.has(fact.target_node_occurrence_id)) {
    return true;
  }
  if (typeof fact.source_node_occurrence_id === 'string' && itemNodes.has(fact.source_node_occurrence_id)) {
    return true;
  }
  return nodeSpan ? spanInside(fact.source_span, nodeSpan) : false;
}

function relationshipAttachesToItem(relationship, itemNodes) {
  if (typeof relationship.target_node_occurrence_id === 'string'
    && itemNodes.has(relationship.target_node_occurrence_id)) {
    return true;
  }
  if (typeof relationship.source_node_occurrence_id === 'string'
    && itemNodes.has(relationship.source_node_occurrence_id)) {
    return true;
  }
  return relationship.source_node_occurrence_ids.some((id) => itemNodes.has(id));
}

function classifyPartyWordLocation(uses, nodeSpan, governingSpan, articleSpan, hasSourceNode) {
  if (!hasSourceNode) {
    return { location: 'NO_SOURCE_NODE', span: uses[0]?.span ?? null };
  }
  const inNode = uses.filter((use) => nodeSpan && spanInside(use.span, nodeSpan));
  if (inNode.length > 0) return { location: 'OWN_NODE', span: inNode[0].span };
  const inGoverning = uses.filter((use) => governingSpan && spanInside(use.span, governingSpan));
  if (inGoverning.length > 0) return { location: 'GOVERNING_CHAPEAU', span: inGoverning[0].span };
  const inArticle = uses.filter((use) => articleSpan && spanInside(use.span, articleSpan));
  if (inArticle.length > 0) return { location: 'ARTICLE_CHAPEAU_ONLY', span: inArticle[0].span };
  return { location: 'NONE', span: null };
}

function sourceMixKey(m4, m2, m3, hasSourceNode) {
  if (!hasSourceNode) return 'NO_SOURCE_NODE';
  const parts = [];
  if (m4) parts.push('M4');
  if (m2) parts.push('M2');
  if (m3) parts.push('M3');
  return parts.length > 0 ? parts.join('+') : 'NONE';
}

function renderMarkdown(report) {
  const lines = [];
  lines.push('# Party-identity census (Q-0015)');
  lines.push('');
  lines.push('Ten Work 3 agreements. M4 party is `legacy_party` on analysis claims; a party span is `legacy_claim_revision.party_source_span` or the equivalent fields inspected on the claim object. M2 party terms are the seed list plus every `DEFINED_TERM_DEFINITION` whose span sits in the preamble (AGREEMENT children before the first ARTICLE). M3 fact “kind” is the fact `role`. V2 can mint `APPLIES_TO` only from resolved `BOUND_ENTITY` relationships (`projectPartyEdges` in `m7-v2-deterministic-generator.js`).');
  lines.push('');
  lines.push(`- M4 claims: **${report.counts.m4_claims}**. With party: **${report.counts.m4_with_party}**. With party span: **${report.counts.m4_with_span}**. With neither: **${report.counts.m4_with_neither}**.`);
  lines.push(`- M3 \`BOUND_ENTITY\` relationships: **${report.counts.m3_bound_entity}** of ${report.counts.m3_relationships}.`);
  lines.push(`- Fixed-50 items: **${report.counts.items}**. Item 39 has no source node.`);
  lines.push(`- Table SHA-256: \`${report.table_sha256}\`.`);
  lines.push('');
  lines.push('## Field cites');
  lines.push('');
  lines.push(`- M4 \`legacy_party\` assignment: \`${FIELD_CITES.m4_legacy_party.path}:${FIELD_CITES.m4_legacy_party.assignment_line}\` — \`${FIELD_CITES.m4_legacy_party.assignment_text}\``);
  lines.push(`- M4 \`legacy_party\` field: \`${FIELD_CITES.m4_legacy_party.path}:${FIELD_CITES.m4_legacy_party.line}\` — \`${FIELD_CITES.m4_legacy_party.text}\``);
  lines.push(`- M4 \`legacy_party: null\` on the golden/fixture claim path: \`${FIELD_CITES.m4_legacy_party_null.path}:${FIELD_CITES.m4_legacy_party_null.line}\` — \`${FIELD_CITES.m4_legacy_party_null.text}\``);
  lines.push(`- Resolver \`party_source_span\`: \`${FIELD_CITES.resolver_party_source_span.path}:${FIELD_CITES.resolver_party_source_span.line}\` — \`${FIELD_CITES.resolver_party_source_span.text}\``);
  lines.push(`- V2 \`BOUND_ENTITY\` gate: \`${FIELD_CITES.v2_bound_entity_gate.path}:${FIELD_CITES.v2_bound_entity_gate.line}\` — \`${FIELD_CITES.v2_bound_entity_gate.text}\``);
  lines.push('');
  lines.push('Inspected M4 claim objects: `legacy_party` is `{ capacity, role, value }` or null. No claim, `legacy_claim_revision`, or `legacy_party` object carries `party_source_span` / `party_span` / `source_span`. Evidence `absolute_start` / `absolute_end` and analysis `evidence_edges.source_span` are operative-text evidence, not a party span.');
  lines.push('');
  lines.push('Seed terms `Parent`, `Merger Sub`, `Buyer`, `Purchaser`, and `Guarantor` have zero M2 definition/use annotations on most agreements. The preamble text does name Parent and Sub (often with curly quotes), but those strings are not present as `DEFINED_TERM_DEFINITION` values, so this census does not invent uses for them. One agreement annotates `Parent` and `Purchaser`.');
  lines.push('');
  lines.push('## M3 relationship kinds');
  lines.push('');
  lines.push('| Kind | Count |');
  lines.push('| --- | ---: |');
  for (const [kind, count] of Object.entries(report.relationship_kinds)) {
    lines.push(`| \`${kind}\` | ${count} |`);
  }
  lines.push(`| **Total** | ${report.counts.m3_relationships} |`);
  lines.push('');
  lines.push('## Per-agreement counts');
  lines.push('');
  lines.push('| Agreement | M4 claims | Party | Span | Neither | M2 party terms | M2 defs | M2 uses | M3 facts | CAPACITY | Party-naming facts | Relationships | BOUND_ENTITY |');
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const row of report.agreements) {
    const id = `${row.agreement_id.slice(0, 12)}…`;
    lines.push(`| ${id} | ${row.m4.claim_count} | ${row.m4.with_party} | ${row.m4.with_span} | ${row.m4.with_neither} | ${row.m2.party_term_count} | ${row.m2.definition_count} | ${row.m2.use_count} | ${row.m3.fact_count} | ${row.m3.capacity_fact_count} | ${row.m3.party_naming_fact_count} | ${row.m3.relationship_count} | ${row.m3.bound_entity} |`);
  }
  lines.push(`| **Total** | ${report.counts.m4_claims} | ${report.counts.m4_with_party} | ${report.counts.m4_with_span} | ${report.counts.m4_with_neither} | — | ${report.counts.m2_definitions} | ${report.counts.m2_uses} | ${report.counts.m3_facts} | ${report.counts.m3_capacity_facts} | ${report.counts.m3_party_naming_facts} | ${report.counts.m3_relationships} | ${report.counts.m3_bound_entity} |`);
  lines.push('');
  lines.push('### Party terms per agreement');
  lines.push('');
  for (const row of report.agreements) {
    lines.push(`#### \`${row.agreement_id}\``);
    lines.push('');
    lines.push(`Preamble window bytes ${row.m2.preamble.start_byte}–${row.m2.preamble.end_byte} (${row.m2.preamble.node_count} AGREEMENT children). Preamble-defined terms: ${row.m2.preamble_defined_terms.length === 0 ? '—' : row.m2.preamble_defined_terms.map((term) => `\`${term}\``).join(', ')}.`);
    lines.push('');
    lines.push('| Term | Seed | Preamble | Defs | Uses | First definition span | SHA verified |');
    lines.push('| --- | --- | --- | ---: | ---: | --- | --- |');
    for (const term of row.m2.party_terms) {
      const first = term.definition_spans[0];
      const spanText = first
        ? `${first.span.start_byte}–${first.span.end_byte}`
        : '—';
      const verified = first ? (first.span.verified ? 'yes' : 'no') : '—';
      lines.push(`| \`${term.term}\` | ${term.in_seed ? 'yes' : '—'} | ${term.preamble_defined ? 'yes' : '—'} | ${term.definition_count} | ${term.use_count} | ${spanText} | ${verified} |`);
    }
    lines.push('');
  }

  lines.push('## Fixed-50 source mix');
  lines.push('');
  lines.push('| Sources | Items |');
  lines.push('| --- | ---: |');
  for (const [key, count] of Object.entries(report.counts.fixed50_source_mix)) {
    lines.push(`| ${key} | ${count} |`);
  }
  lines.push('');
  lines.push('| Party-word location | Items |');
  lines.push('| --- | ---: |');
  for (const [key, count] of Object.entries(report.counts.fixed50_location_mix)) {
    lines.push(`| ${key} | ${count} |`);
  }
  lines.push('');
  lines.push('| # | Family | Sources | M4 party | M2 terms | M3 | Location | Span |');
  lines.push('| ---: | --- | --- | --- | --- | --- | --- | --- |');
  for (const item of report.items) {
    const family = item.family_key ?? '—';
    const m4 = item.m4.parties.length === 0
      ? '—'
      : [...new Set(item.m4.parties.map((party) => party.value ?? party.capacity ?? '?'))].join(', ');
    const m2 = item.m2.terms.length === 0 ? '—' : item.m2.terms.map((term) => `\`${term}\``).join(', ');
    const m3 = item.m3.gives_party
      ? `${item.m3.party_naming_fact_count} naming / ${item.m3.attached_relationship_count} rel / ${item.m3.capacity_fact_count} CAPACITY`
      : (item.m3.capacity_fact_count > 0 ? `${item.m3.capacity_fact_count} CAPACITY only` : '—');
    const span = item.party_word_span
      ? `${item.party_word_span.start_byte}–${item.party_word_span.end_byte}`
      : '—';
    lines.push(`| ${item.sample_ordinal} | ${family} | ${item.source_mix} | ${m4.replace(/\|/g, '\\|')} | ${m2} | ${m3} | ${item.party_word_location} | ${span} |`);
  }
  lines.push('');
  const item39 = report.items.find((item) => item.sample_ordinal === 39);
  const item39Span = item39?.party_word_span
    ? ` An M2 \`${item39.m2.terms[0] ?? 'party'}\` use still overlaps the identity source span (bytes ${item39.party_word_span.start_byte}–${item39.party_word_span.end_byte}); that is recorded on the row but the source mix stays \`NO_SOURCE_NODE\`.`
    : '';
  lines.push(`Item 39 is the parser-ambiguity member and has no \`source_node_occurrence_id\`. M4 intersecting claims and M3 target-node attachment therefore cannot fire.${item39Span}`);
  lines.push('');
  if (report.missing_paths.length > 0) {
    lines.push('## Missing paths');
    lines.push('');
    for (const path of report.missing_paths) lines.push(`- \`${path}\``);
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

function renderOut(report) {
  const lines = [];
  lines.push(`agreements ${report.counts.agreements}`);
  lines.push(`m4_claims ${report.counts.m4_claims}`);
  lines.push(`m4_with_party ${report.counts.m4_with_party}`);
  lines.push(`m4_with_span ${report.counts.m4_with_span}`);
  lines.push(`m4_with_neither ${report.counts.m4_with_neither}`);
  lines.push(`m3_bound_entity ${report.counts.m3_bound_entity}`);
  lines.push(`m3_relationships ${report.counts.m3_relationships}`);
  lines.push('relationship_kinds');
  for (const [kind, count] of Object.entries(report.relationship_kinds)) {
    lines.push(`  ${kind} ${count}`);
  }
  lines.push('fixed50_source_mix');
  for (const [key, count] of Object.entries(report.counts.fixed50_source_mix)) {
    lines.push(`  ${key} ${count}`);
  }
  lines.push('fixed50_location_mix');
  for (const [key, count] of Object.entries(report.counts.fixed50_location_mix)) {
    lines.push(`  ${key} ${count}`);
  }
  lines.push(`items ${report.counts.items}`);
  lines.push(`missing_paths ${report.missing_paths.length}`);
  lines.push(`table_sha256 ${report.table_sha256}`);
  return `${lines.join('\n')}\n`;
}

function main() {
  const missingPaths = [];
  const identity = loadJson(IDENTITY_PATH);
  const indexSet = loadJson(INDEX_SET_PATH);
  const contextSet = loadJson(CONTEXT_SET_PATH);
  const analysisSet = loadJson(ANALYSIS_SET_PATH);
  if (!existsSync(CLOSURES_PATH)) missingPaths.push(rel(CLOSURES_PATH));
  const closures = existsSync(CLOSURES_PATH) ? loadJson(CLOSURES_PATH) : { items: [] };
  const closuresByOrdinal = new Map();
  for (const item of closures.items ?? []) {
    closuresByOrdinal.set(item.sample_ordinal, item);
  }

  const analysisByAgreement = new Map();
  for (const member of analysisSet.members ?? []) {
    const loaded = loadMemberPath(
      member?.agreement_analysis_binding?.path,
      missingPaths,
      'work3-analysis-set member',
    );
    if (!loaded) continue;
    const agreementId = member.agreement_id ?? loaded.record.agreement_id;
    if (typeof agreementId !== 'string') {
      missingPaths.push(`${loaded.path} (no agreement_id)`);
      continue;
    }
    analysisByAgreement.set(agreementId, {
      path: loaded.path,
      claims: Array.isArray(loaded.record.claims) ? loaded.record.claims : [],
    });
  }

  const contextPathByAgreement = new Map();
  for (const member of contextSet.members ?? []) {
    const agreementId = member?.agreement_id;
    const memberPath = member?.context_compilation_binding?.path;
    if (typeof agreementId !== 'string' || typeof memberPath !== 'string') {
      missingPaths.push('work3-context-set member missing agreement_id or path');
      continue;
    }
    contextPathByAgreement.set(agreementId, memberPath);
  }

  const indexPathByAgreement = new Map();
  for (const member of indexSet.members ?? []) {
    const memberPath = member?.path;
    if (typeof memberPath !== 'string' || memberPath.length === 0) {
      missingPaths.push('work3-index-set member missing path');
      continue;
    }
    const abs = resolve(repoRoot, memberPath);
    if (!existsSync(abs)) {
      missingPaths.push(memberPath);
      continue;
    }
    const record = loadJson(abs);
    const agreementId = record?.source_binding?.agreement_id;
    if (typeof agreementId !== 'string') {
      missingPaths.push(`${memberPath} (no source_binding.agreement_id)`);
      continue;
    }
    indexPathByAgreement.set(agreementId, memberPath);
  }

  const agreementIds = [...new Set([
    ...analysisByAgreement.keys(),
    ...contextPathByAgreement.keys(),
    ...indexPathByAgreement.keys(),
  ])].sort(compareText);

  const relationshipKinds = new Map();
  const agreements = [];
  const m2ByAgreement = new Map();
  const m3ByAgreement = new Map();

  for (const agreementId of agreementIds) {
    const analysis = analysisByAgreement.get(agreementId) ?? null;
    const indexPath = indexPathByAgreement.get(agreementId) ?? null;
    const contextPath = contextPathByAgreement.get(agreementId) ?? null;
    if (!analysis) missingPaths.push(`analysis missing for ${agreementId}`);
    if (!indexPath) missingPaths.push(`index missing for ${agreementId}`);
    if (!contextPath) missingPaths.push(`context missing for ${agreementId}`);

    const indexLoaded = indexPath
      ? loadMemberPath(indexPath, missingPaths, 'work3-index-set member')
      : null;
    const contextLoaded = contextPath
      ? loadMemberPath(contextPath, missingPaths, 'work3-context-set member')
      : null;

    const m4 = censusM4(analysis?.claims ?? []);
    const m2 = indexLoaded ? censusM2(indexLoaded.record, missingPaths) : null;
    const m3 = contextLoaded
      ? censusM3(contextLoaded.record, m2?.party_term_names ?? [...SEED_PARTY_TERMS])
      : null;

    if (m3) {
      for (const [kind, count] of Object.entries(m3.relationship_kinds)) {
        bump(relationshipKinds, kind, count);
      }
    }

    if (m2) {
      m2ByAgreement.set(agreementId, {
        party_term_names: m2.party_term_names,
        party_uses: m2.party_uses,
        preamble: m2.preamble,
      });
    }
    if (m3) {
      m3ByAgreement.set(agreementId, {
        capacity_facts: m3.capacity_facts,
        party_naming_facts: m3.party_naming_facts,
        relationships: m3.relationships,
      });
    }

    agreements.push({
      agreement_id: agreementId,
      m2_path: indexLoaded?.path ?? indexPath,
      m3_path: contextLoaded?.path ?? contextPath,
      m4_path: analysis?.path ?? null,
      m4,
      m2: m2
        ? {
          annotation_kinds: m2.annotation_kinds,
          definition_count: m2.party_terms.reduce((sum, row) => sum + row.definition_count, 0),
          party_term_count: m2.party_terms.length,
          party_term_names: m2.party_term_names,
          party_terms: m2.party_terms,
          preamble: {
            end_byte: m2.preamble.end_byte,
            first_article_start_byte: m2.preamble.first_article_start_byte,
            node_count: m2.preamble.node_count,
            start_byte: m2.preamble.start_byte,
          },
          preamble_defined_terms: m2.preamble_defined_terms,
          sha_mismatch_definition_spans: m2.sha_mismatch_definition_spans,
          use_count: m2.party_terms.reduce((sum, row) => sum + row.use_count, 0),
        }
        : null,
      m3: m3
        ? {
          bound_entity: m3.relationship_kinds.BOUND_ENTITY ?? 0,
          capacity_fact_count: m3.capacity_facts.length,
          capacity_value_counts: m3.capacity_value_counts,
          fact_count: m3.fact_count,
          fact_roles: m3.fact_roles,
          party_naming_fact_count: m3.party_naming_facts.length,
          party_naming_facts_by_role: m3.party_naming_facts_by_role,
          relationship_count: m3.relationship_count,
          relationship_kind_states: m3.relationship_kind_states,
          relationship_kinds: m3.relationship_kinds,
        }
        : null,
    });

    if (m2) m2.canonical_bytes = null;
  }

  const members = identity.members;
  if (!Array.isArray(members) || members.length !== 50) {
    throw new Error(`expected 50 identity members, got ${members?.length}`);
  }

  const items = [];
  const sourceMix = new Map();
  const locationMix = new Map();

  for (const member of [...members].sort((left, right) => left.sample_ordinal - right.sample_ordinal)) {
    const itemNodes = new Set(
      (member.source_node_occurrence_ids ?? [])
        .filter((id) => typeof id === 'string' && id.length > 0),
    );
    const hasSourceNode = itemNodes.size > 0;
    const closure = closuresByOrdinal.get(member.sample_ordinal) ?? null;
    const closureNode = closure?.nodes?.[0] ?? null;
    const nodeSpan = closureUsableSpan(closureNode?.span)
      ?? completeSpan(member.source_spans?.[0] ?? null);
    const governingSpan = closureUsableSpan(closureNode?.governing_chapeau);
    const articleSpan = closureUsableSpan(closureNode?.article_representing_chapeau);

    const analysis = analysisByAgreement.get(member.agreement_id);
    const hits = intersectingClaims(analysis?.claims ?? [], itemNodes);
    const m4Parties = [];
    for (const claim of hits) {
      if (!hasLegacyParty(claim)) continue;
      m4Parties.push({
        analysis_claim_id: claim.analysis_claim_id ?? null,
        capacity: claim.legacy_party?.capacity ?? null,
        claim_definition_key: claim.claim_definition_key ?? null,
        role: claim.legacy_party?.role ?? null,
        span: partySpanFromClaim(claim),
        value: claim.legacy_party?.value ?? null,
      });
    }

    const m2 = m2ByAgreement.get(member.agreement_id);
    const partyUses = (m2?.party_uses ?? []).filter((use) => {
      if (nodeSpan && spanInside(use.span, nodeSpan)) return true;
      if (governingSpan && spanInside(use.span, governingSpan)) return true;
      if (articleSpan && spanInside(use.span, articleSpan)) return true;
      return false;
    }).sort((left, right) => {
      const start = (left.span.start_byte ?? 0) - (right.span.start_byte ?? 0);
      if (start !== 0) return start;
      return compareText(left.term, right.term);
    });
    const m2Terms = [...new Set(partyUses.map((use) => use.term))].sort(compareText);

    const m3 = m3ByAgreement.get(member.agreement_id);
    const attachedCapacity = (m3?.capacity_facts ?? [])
      .filter((fact) => factAttachesToItem(fact, itemNodes, nodeSpan));
    const attachedNaming = (m3?.party_naming_facts ?? [])
      .filter((fact) => factAttachesToItem(fact, itemNodes, nodeSpan));
    const attachedRels = (m3?.relationships ?? [])
      .filter((relationship) => relationshipAttachesToItem(relationship, itemNodes));
    const partyRels = attachedRels.filter((relationship) => {
      if (relationship.relationship_type === 'BOUND_ENTITY') return true;
      const labels = [relationship.source_endpoint_label, relationship.target_endpoint_label];
      return labels.some((label) => valueNamesPartyTerm(label, m2?.party_term_names ?? SEED_PARTY_TERMS).length > 0);
    });
    const m3GivesParty = attachedNaming.length > 0 || partyRels.length > 0;

    const m4Gives = m4Parties.length > 0;
    const m2Gives = partyUses.length > 0;
    const located = classifyPartyWordLocation(
      partyUses,
      nodeSpan,
      governingSpan,
      articleSpan,
      hasSourceNode,
    );
    const mix = sourceMixKey(m4Gives, m2Gives, m3GivesParty, hasSourceNode);
    bump(sourceMix, mix);
    bump(locationMix, located.location);

    items.push({
      agreement_id: member.agreement_id ?? null,
      article_chapeau: articleSpan,
      family_key: member.family_key ?? null,
      governing_chapeau: governingSpan,
      has_source_node: hasSourceNode,
      item_kind: member.item_kind ?? null,
      m2: {
        gives_party: m2Gives,
        terms: m2Terms,
        use_count: partyUses.length,
        uses: partyUses.slice(0, 12).map((use) => ({
          location: nodeSpan && spanInside(use.span, nodeSpan)
            ? 'OWN_NODE'
            : (governingSpan && spanInside(use.span, governingSpan)
              ? 'GOVERNING_CHAPEAU'
              : (articleSpan && spanInside(use.span, articleSpan)
                ? 'ARTICLE_CHAPEAU_ONLY'
                : 'OTHER')),
          span: use.span,
          term: use.term,
        })),
      },
      m3: {
        attached_relationship_count: attachedRels.length,
        bound_entity_count: attachedRels.filter((row) => row.relationship_type === 'BOUND_ENTITY').length,
        capacity_fact_count: attachedCapacity.length,
        gives_party: m3GivesParty,
        party_naming_fact_count: attachedNaming.length,
        party_relationship_count: partyRels.length,
        party_relationship_types: [...new Set(partyRels.map((row) => row.relationship_type))].sort(compareText),
      },
      m4: {
        claim_count: hits.length,
        gives_party: m4Gives,
        parties: m4Parties,
        with_span: m4Parties.filter((party) => party.span != null).length,
      },
      node_span: nodeSpan,
      party_word_location: located.location,
      party_word_span: located.span,
      review_item_id: member.review_item_id ?? null,
      sample_ordinal: member.sample_ordinal,
      source_mix: mix,
      source_node_occurrence_ids: [...itemNodes].sort(compareText),
    });
  }

  const uniqueMissing = [...new Set(missingPaths)].sort(compareText);
  const tablePayload = sortedObject({ items });
  const tableJson = `${JSON.stringify(tablePayload, null, 2)}\n`;
  const tableSha = sha256Hex(Buffer.from(tableJson, 'utf8'));

  const totals = {
    agreements: agreements.length,
    items: items.length,
    m2_definitions: agreements.reduce((sum, row) => sum + (row.m2?.definition_count ?? 0), 0),
    m2_uses: agreements.reduce((sum, row) => sum + (row.m2?.use_count ?? 0), 0),
    m3_bound_entity: relationshipKinds.get('BOUND_ENTITY') ?? 0,
    m3_capacity_facts: agreements.reduce((sum, row) => sum + (row.m3?.capacity_fact_count ?? 0), 0),
    m3_facts: agreements.reduce((sum, row) => sum + (row.m3?.fact_count ?? 0), 0),
    m3_party_naming_facts: agreements.reduce((sum, row) => sum + (row.m3?.party_naming_fact_count ?? 0), 0),
    m3_relationships: agreements.reduce((sum, row) => sum + (row.m3?.relationship_count ?? 0), 0),
    m4_claims: agreements.reduce((sum, row) => sum + row.m4.claim_count, 0),
    m4_with_neither: agreements.reduce((sum, row) => sum + row.m4.with_neither, 0),
    m4_with_party: agreements.reduce((sum, row) => sum + row.m4.with_party, 0),
    m4_with_span: agreements.reduce((sum, row) => sum + row.m4.with_span, 0),
    fixed50_source_mix: mapToSortedObject(sourceMix),
    fixed50_location_mix: mapToSortedObject(locationMix),
  };

  const report = sortedObject({
    schema: 'Q-0015-PARTY-IDENTITY-CENSUS/V1',
    agreement_analysis_set_id: analysisSet.agreement_analysis_set_id ?? null,
    agreement_index_set_id: indexSet.agreement_index_set_id ?? null,
    context_compilation_set_id: contextSet.context_compilation_set_id ?? null,
    counts: totals,
    field_cites: FIELD_CITES,
    finding: {
      bound_entity_count: totals.m3_bound_entity,
      m4_party_span_fields_found: totals.m4_with_span,
      v2_applies_to_requires_resolved_bound_entity: true,
    },
    identity_manifest_id: identity.fixed_sample_identity_manifest_id ?? null,
    missing_paths: uniqueMissing,
    relationship_kinds: mapToSortedObject(relationshipKinds),
    seed_party_terms: [...SEED_PARTY_TERMS],
    table_sha256: tableSha,
    agreements,
    items,
  });

  const jsonPath = resolve(OUT_DIR, '15-party-identity-census.json');
  const outPath = resolve(OUT_DIR, '15-party-identity-census.out');
  const mdPath = resolve(OUT_DIR, '15-PARTY-IDENTITY.md');
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(outPath, renderOut(report));
  writeFileSync(mdPath, renderMarkdown(report));
  process.stdout.write(renderOut(report));
}

main();
