/**
 * lib/canonical-v2/reviewed-slice-harness.js
 *
 * WP-EXP-01: a pure, generic replay harness for hand-built reviewed
 * deal-slice modules (see reviewed-termination-fee-slice.js,
 * reviewed-qxo-no-shop-slice.js, reviewed-no-shop-slice.js). Those modules
 * are read-only regression oracles. This harness performs ONLY the
 * REPEATED construction mechanics they each hand-roll -- identity
 * derivation via canonical-bytes `contentId`, source/admission/span/
 * excerpt/provision/component assembly via source-structure.js,
 * claim/relationship assembly via claims-relationships.js, result and
 * projection assembly via serving-projection.js, and shared-row assembly
 * via shared-serving-row.js -- driven entirely by plain data. It contains
 * no per-deal text, section numbers, party literals, concept keys, or
 * legal vocabulary of any kind: every such value must arrive via `input`.
 *
 * Discipline: this module never defaults, coerces, or fills a gap. Every
 * shape it accepts is validated with an exact-keys check; anything
 * missing or unrecognised throws a TypeError instead of being guessed.
 * Evidence LOCATION (which bytes hold which fact) is explicitly OUT OF
 * SCOPE: `spans[]` take already-resolved absolute UTF-8 byte offsets.
 * Locating those offsets in a source document (by parser, by reviewer,
 * or by replaying an oracle's own span for a byte-identical regression
 * test) is the caller's job, not the harness's -- text search is not one
 * of the "repeated construction mechanics" this harness mechanises.
 *
 * ---------------------------------------------------------------------
 * INPUT SHAPE (buildReviewedSlice(input)) -- every top-level key below is
 * REQUIRED; providing an extra key, or omitting one, throws.
 * ---------------------------------------------------------------------
 *
 * {
 *   dealKey: string,                 // e.g. 'deal:landos-abbvie'
 *   dealAdmissionSeed: string,       // fed verbatim to contentId('DEAL_ADMISSION/V1', seed)
 *   reviewVersion: string,           // used verbatim as extraction_version /
 *                                    // normalisation_version / derivation_version /
 *                                    // resolver_version on every claim and relationship
 *   corpusReleaseId: string,        // sha256 hex content ID (caller-resolved; no default)
 *   contractBundle: object,          // as returned by contract-bundle.js compileFixtureContract()
 *
 *   deal: { dimensions: object },    // passed through verbatim into the deal row and
 *                                    // into serving-projection's dimension validation
 *
 *   sources: [                       // one entry per admitted immutable source document
 *     {
 *       key: string,                 // referenced by spans[].sourceKey below
 *       text: string,                // full source bytes (utf8)
 *       sourceKind: string,          // e.g. 'PLAIN_UTF8', 'SEC_FILING_EXCERPT_UTF8'
 *       sourceOccurrenceKey: string,
 *       expectedDocumentHash: string,// sha256 hex; harness throws on any mismatch
 *       admissionOrdinal: integer,   // >= 0, this source's position in the deal admission
 *     }, ...
 *   ],
 *
 *   spans: [                         // pre-resolved evidence anchors: ABSOLUTE UTF-8 BYTE
 *     { key, sourceKey, absoluteStart, absoluteEnd }, ...   // offsets, half-open [start, end)
 *   ],
 *
 *   excerpts: [ { key, spanKey }, ... ],   // one governed excerpt per span that needs one
 *
 *   provisions: [
 *     { key, spanKey, conceptKey, party, ordinal }, ...
 *   ],
 *
 *   components: [
 *     { key, parentProvisionKey, spanKey, componentKey, ordinal }, ...
 *   ],
 *
 *   claims: [
 *     {
 *       key,
 *       subjectComponentKey: string,       // -> component.provision_component_id
 *       claimDefinitionKey: string,
 *       ordinal: integer,
 *       state: string,                     // 'PRESENT' | 'ABSENT' | ...
 *       rawValueExcerptKey: string,        // raw_value = excerpts[key].exact_text
 *       normalisation:
 *           { kind: 'money_relative_to_deal_value', rawAmount, currency,
 *             denominator: { value, currency, basis, sourceLineageExcerptKeys: [string] } }
 *         | { kind: 'duration_to_days', rawMagnitude, rawUnit, dayBasis, trigger },
 *       extraAttributes: object,           // merged into money-kind attributes only;
 *                                          // must be {} for duration-kind claims
 *       evidence: [ { excerptKey, role, documentOrdinal }, ... ],
 *       scopeClosureKind: 'evidence_id_list' | 'subject_and_single_excerpt',
 *     }, ...
 *   ],
 *
 *   relationships: [
 *     {
 *       key,
 *       sourceComponentKey: string,
 *       relationshipDefinitionKey: string,
 *       ordinal: integer,
 *       state: string,
 *       rawScopeExcerptKey: string,        // raw_scope = excerpts[key].exact_text
 *       targetComponentKeys: [string],
 *       effect: object,                    // passed through verbatim
 *       evidence: [ { excerptKey, role, documentOrdinal }, ... ],
 *       targetIntervalExcerptKeys: [string],
 *     }, ...
 *   ],
 *
 *   results: [
 *     {
 *       key, resultKey, resultVersion, conceptKey, party, valueSlotKey, ordinal,
 *       claimKey, relationshipKeys: [string],
 *       completeness: 'COMPLETE' | 'INCOMPLETE',
 *       comparability: 'COMPARABLE' | 'NOT_CERTIFIED' | 'NOT_COMPARABLE',
 *       metricKey: string,                 // serving-projection METRIC_DEFINITIONS key
 *       compositionScopeClosureShape: 'claim_and_relationships' | 'claim_scalar',
 *     }, ...
 *   ],
 *
 *   servingRows: [                          // OPTIONAL set, but the array key itself
 *                                            // is always required (use [] for none)
 *     { key, resultKey, servingNamespaceId, resultOrdinal }, ...
 *   ],
 *
 *   reviewedMapping: {
 *     primarySourceKey: string,             // whose document_hash names the mapping/deal
 *     structuralSectionProposalIds: [string] | null,  // sorted into the mapping when not null
 *     governedEvidenceExcerptKeys: [string],// explicit excerpt-key allowlist (oracles do not
 *                                           // always publish every excerpt as governed evidence)
 *   },
 *
 *   semanticClosure: {
 *     admissionFieldStyle: 'singular' | 'plural',  // oracles disagree on this key's shape
 *     includeComponentIds: boolean,
 *   },
 *
 *   canonicalWriteSetShape: 'plural_sources' | 'singular_source',
 * }
 *
 * Divergence note: the reviewed slice oracles do not agree on the exact
 * field shape of a SEMANTIC_CLOSURE/V1 payload or of canonicalWriteSet's
 * source bag (singular vs plural keys), nor on whether a result's
 * COMPOSITION_SCOPE_CLOSURE/V1 payload is a bare claim id or an object
 * with relationship ids attached, nor on which excerpts count as
 * "governed evidence" for a REVIEWED_CANONICAL_MAPPING/V1. Rather than
 * have the harness guess which shape a new deal wants, the caller picks
 * explicitly via the switches above. See docs/archive/handoffs/
 * SPEC-WP-EXP-01-HARNESS-2026-07-23.md.
 */

'use strict';

const { canonicalJson, contentId } = require('./canonical-bytes');
const { buildClaimRevision, buildRelationshipRevision } = require('./claims-relationships');
const { moneyDenominatorPrecisionPolicyForClaim } = require('./contract-bundle');
const { compileMarketCohortRequest } = require('./market-cohort-query');
const { normaliseDurationToDays, normaliseMoneyRelativeToDealValue } = require('./observation-normalisers');
const { buildFixtureResultComponent, projectMarketMetricSlot } = require('./serving-projection');
const { buildCanonicalResultServingRow } = require('./shared-serving-row');
const {
  buildExcerpt,
  buildFixtureSourceAdmission,
  buildImmutableSource,
  buildProvisionComponent,
  buildProvisionInstance,
  buildSemanticSpan,
} = require('./source-structure');

const SHA256_RE = /^[a-f0-9]{64}$/;

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function requirePlainObject(value, label) {
  if (!isPlainObject(value)) throw new TypeError(`${label} must be a plain object`);
  return value;
}

function requireArray(value, label) {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array`);
  return value;
}

function requireString(value, label) {
  if (typeof value !== 'string' || !value.length) throw new TypeError(`${label} must be a non-empty string`);
  return value;
}

function requireDigest(value, label) {
  if (!SHA256_RE.test(value || '')) throw new TypeError(`${label} must be a full SHA-256 content ID`);
  return value;
}

function requireInteger(value, label, { min = -Infinity } = {}) {
  if (!Number.isInteger(value) || value < min) throw new TypeError(`${label} must be an integer >= ${min}`);
  return value;
}

function requireExactKeys(value, keys, label) {
  requirePlainObject(value, label);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    throw new TypeError(`${label} fields do not match the harness input contract (expected exactly: ${expected.join(', ')})`);
  }
}

function freshRegistry() {
  return new Map();
}

function addUnique(registry, key, value, label) {
  if (typeof key !== 'string' || !key.length) throw new TypeError(`${label} entries require a non-empty string key`);
  if (registry.has(key)) throw new TypeError(`${label} key is duplicated: ${key}`);
  registry.set(key, value);
}

function lookup(registry, key, label) {
  if (typeof key !== 'string' || !registry.has(key)) throw new TypeError(`${label} references an unknown key: ${key}`);
  return registry.get(key);
}

const SOURCE_KEYS = Object.freeze(['key', 'text', 'sourceKind', 'sourceOccurrenceKey', 'expectedDocumentHash', 'admissionOrdinal']);
const SPAN_KEYS = Object.freeze(['key', 'sourceKey', 'absoluteStart', 'absoluteEnd']);
const EXCERPT_KEYS = Object.freeze(['key', 'spanKey']);
const PROVISION_KEYS = Object.freeze(['key', 'spanKey', 'conceptKey', 'party', 'ordinal']);
const COMPONENT_KEYS = Object.freeze(['key', 'parentProvisionKey', 'spanKey', 'componentKey', 'ordinal']);
const EVIDENCE_INPUT_KEYS = Object.freeze(['excerptKey', 'role', 'documentOrdinal']);
const CLAIM_KEYS = Object.freeze([
  'key', 'subjectComponentKey', 'claimDefinitionKey', 'ordinal', 'state',
  'rawValueExcerptKey', 'normalisation', 'extraAttributes', 'evidence', 'scopeClosureKind',
]);
const NORMALISATION_MONEY_KEYS = Object.freeze(['kind', 'rawAmount', 'currency', 'denominator']);
const DENOMINATOR_KEYS = Object.freeze(['value', 'currency', 'basis', 'sourceLineageExcerptKeys']);
const GOVERNED_DENOMINATOR_KEYS = Object.freeze([...DENOMINATOR_KEYS, 'precision']);
const NORMALISATION_DURATION_KEYS = Object.freeze(['kind', 'rawMagnitude', 'rawUnit', 'dayBasis', 'trigger']);
const RELATIONSHIP_KEYS = Object.freeze([
  'key', 'sourceComponentKey', 'relationshipDefinitionKey', 'ordinal', 'state',
  'rawScopeExcerptKey', 'targetComponentKeys', 'effect', 'evidence', 'targetIntervalExcerptKeys',
]);
const RESULT_KEYS = Object.freeze([
  'key', 'resultKey', 'resultVersion', 'conceptKey', 'party', 'valueSlotKey', 'ordinal',
  'claimKey', 'relationshipKeys', 'completeness', 'comparability', 'metricKey',
  'compositionScopeClosureShape',
]);
const SERVING_ROW_KEYS = Object.freeze(['key', 'resultKey', 'servingNamespaceId', 'resultOrdinal']);
const REVIEWED_MAPPING_KEYS = Object.freeze(['primarySourceKey', 'structuralSectionProposalIds', 'governedEvidenceExcerptKeys']);
const SEMANTIC_CLOSURE_KEYS = Object.freeze(['admissionFieldStyle', 'includeComponentIds']);
const TOP_LEVEL_KEYS = Object.freeze([
  'dealKey', 'dealAdmissionSeed', 'reviewVersion', 'corpusReleaseId', 'contractBundle',
  'deal', 'sources', 'spans', 'excerpts', 'provisions', 'components', 'claims',
  'relationships', 'results', 'servingRows', 'reviewedMapping', 'semanticClosure',
  'canonicalWriteSetShape',
]);

function buildSources({ dealKey, dealAdmissionId, contractBundle, sourcesInput }) {
  const registry = freshRegistry();
  for (const entry of requireArray(sourcesInput, 'sources')) {
    requireExactKeys(entry, SOURCE_KEYS, 'sources[]');
    requireString(entry.key, 'sources[].key');
    requireString(entry.text, 'sources[].text');
    requireString(entry.sourceKind, 'sources[].sourceKind');
    requireString(entry.sourceOccurrenceKey, 'sources[].sourceOccurrenceKey');
    requireDigest(entry.expectedDocumentHash, 'sources[].expectedDocumentHash');
    requireInteger(entry.admissionOrdinal, 'sources[].admissionOrdinal', { min: 0 });
    const source = buildImmutableSource({
      sourceBytes: entry.text,
      sourceKind: entry.sourceKind,
      sourceOccurrenceKey: entry.sourceOccurrenceKey,
    });
    if (source.document_hash !== entry.expectedDocumentHash) {
      throw new TypeError(`source "${entry.key}" document hash does not match expectedDocumentHash`);
    }
    const admission = buildFixtureSourceAdmission({
      source,
      dealKey,
      dealAdmissionId,
      contractFingerprint: contractBundle.fingerprint,
      sourceOrdinal: entry.admissionOrdinal,
    });
    addUnique(registry, entry.key, { source, admission }, 'sources[]');
  }
  return registry;
}

function buildSpans({ sourcesRegistry, spansInput }) {
  const registry = freshRegistry();
  for (const entry of requireArray(spansInput, 'spans')) {
    requireExactKeys(entry, SPAN_KEYS, 'spans[]');
    requireString(entry.key, 'spans[].key');
    const { source } = lookup(sourcesRegistry, entry.sourceKey, 'spans[].sourceKey');
    requireInteger(entry.absoluteStart, 'spans[].absoluteStart', { min: 0 });
    requireInteger(entry.absoluteEnd, 'spans[].absoluteEnd', { min: 0 });
    const span = buildSemanticSpan(source, entry.absoluteStart, entry.absoluteEnd);
    addUnique(registry, entry.key, { span, sourceKey: entry.sourceKey }, 'spans[]');
  }
  return registry;
}

function buildExcerpts({ sourcesRegistry, spansRegistry, excerptsInput }) {
  const registry = freshRegistry();
  for (const entry of requireArray(excerptsInput, 'excerpts')) {
    requireExactKeys(entry, EXCERPT_KEYS, 'excerpts[]');
    requireString(entry.key, 'excerpts[].key');
    const { span, sourceKey } = lookup(spansRegistry, entry.spanKey, 'excerpts[].spanKey');
    const { source } = lookup(sourcesRegistry, sourceKey, 'excerpts[].spanKey->sourceKey');
    addUnique(registry, entry.key, buildExcerpt({ source, span }), 'excerpts[]');
  }
  return registry;
}

function buildProvisions({
  sourcesRegistry,
  spansRegistry,
  provisionsInput,
  contractBundle,
}) {
  const registry = freshRegistry();
  for (const entry of requireArray(provisionsInput, 'provisions')) {
    requireExactKeys(entry, PROVISION_KEYS, 'provisions[]');
    requireString(entry.key, 'provisions[].key');
    const { span, sourceKey } = lookup(spansRegistry, entry.spanKey, 'provisions[].spanKey');
    const { source } = lookup(sourcesRegistry, sourceKey, 'provisions[].spanKey->sourceKey');
    requireString(entry.conceptKey, 'provisions[].conceptKey');
    requirePlainObject(entry.party, 'provisions[].party');
    requireInteger(entry.ordinal, 'provisions[].ordinal');
    const provision = buildProvisionInstance({
      source,
      span,
      conceptKey: entry.conceptKey,
      party: entry.party,
      ordinal: entry.ordinal,
      contractBundle,
    });
    addUnique(registry, entry.key, { provision, sourceKey }, 'provisions[]');
  }
  return registry;
}

function buildComponents({
  sourcesRegistry,
  spansRegistry,
  provisionsRegistry,
  componentsInput,
  contractBundle,
}) {
  const registry = freshRegistry();
  for (const entry of requireArray(componentsInput, 'components')) {
    requireExactKeys(entry, COMPONENT_KEYS, 'components[]');
    requireString(entry.key, 'components[].key');
    const { provision } = lookup(provisionsRegistry, entry.parentProvisionKey, 'components[].parentProvisionKey');
    const { span, sourceKey } = lookup(spansRegistry, entry.spanKey, 'components[].spanKey');
    const { source } = lookup(sourcesRegistry, sourceKey, 'components[].spanKey->sourceKey');
    requireString(entry.componentKey, 'components[].componentKey');
    requireInteger(entry.ordinal, 'components[].ordinal');
    const component = buildProvisionComponent({
      source,
      parentProvision: provision,
      span,
      componentKey: entry.componentKey,
      ordinal: entry.ordinal,
      contractBundle,
    });
    addUnique(registry, entry.key, { component, sourceKey }, 'components[]');
  }
  return registry;
}

function resolveEvidenceList(evidenceInput, excerptsRegistry, label) {
  return requireArray(evidenceInput, label).map((item, index) => {
    requireExactKeys(item, EVIDENCE_INPUT_KEYS, `${label}[${index}]`);
    const excerpt = lookup(excerptsRegistry, item.excerptKey, `${label}[${index}].excerptKey`);
    requireString(item.role, `${label}[${index}].role`);
    requireInteger(item.documentOrdinal, `${label}[${index}].documentOrdinal`, { min: 0 });
    return {
      evidence_role: item.role,
      excerpt_id: excerpt.excerpt_id,
      document_ordinal: item.documentOrdinal,
      absolute_start: excerpt.absolute_start,
      absolute_end: excerpt.absolute_end,
    };
  });
}

function buildClaimScope({ scopeClosureKind, evidenceRows, subjectOccurrenceId }) {
  const evidenceIds = [...new Set(evidenceRows.map((row) => row.excerpt_id))].sort();
  if (scopeClosureKind === 'evidence_id_list') {
    return {
      scope_closure_id: contentId('CLAIM_SCOPE_CLOSURE/V1', evidenceIds),
      coverage_status: 'COMPLETE',
      required_interval_ids: evidenceIds,
      examined_interval_ids: evidenceIds,
    };
  }
  if (scopeClosureKind === 'subject_and_single_excerpt') {
    if (evidenceRows.length !== 1) {
      throw new TypeError('claims[].scopeClosureKind "subject_and_single_excerpt" requires exactly one evidence row');
    }
    const excerptId = evidenceRows[0].excerpt_id;
    return {
      scope_closure_id: contentId('CLAIM_SCOPE_CLOSURE/V1', { subject: subjectOccurrenceId, excerpt_id: excerptId }),
      coverage_status: 'COMPLETE',
      required_interval_ids: [excerptId],
      examined_interval_ids: [excerptId],
    };
  }
  throw new TypeError(`unknown claims[].scopeClosureKind: ${scopeClosureKind}`);
}

function buildClaims({
  reviewVersion,
  contractBundle,
  componentsRegistry,
  excerptsRegistry,
  claimsInput,
}) {
  const registry = freshRegistry();
  for (const entry of requireArray(claimsInput, 'claims')) {
    requireExactKeys(entry, CLAIM_KEYS, 'claims[]');
    requireString(entry.key, 'claims[].key');
    const { component } = lookup(componentsRegistry, entry.subjectComponentKey, 'claims[].subjectComponentKey');
    requireString(entry.claimDefinitionKey, 'claims[].claimDefinitionKey');
    requireInteger(entry.ordinal, 'claims[].ordinal', { min: 0 });
    requireString(entry.state, 'claims[].state');
    const rawValueExcerpt = lookup(excerptsRegistry, entry.rawValueExcerptKey, 'claims[].rawValueExcerptKey');
    requirePlainObject(entry.normalisation, 'claims[].normalisation');
    requirePlainObject(entry.extraAttributes, 'claims[].extraAttributes');
    const evidenceRows = resolveEvidenceList(entry.evidence, excerptsRegistry, 'claims[].evidence');
    requireString(entry.scopeClosureKind, 'claims[].scopeClosureKind');

    let canonicalValue;
    let unit;
    let dayBasis = null;
    let denominator = null;
    let attributes;
    const kind = entry.normalisation.kind;
    if (kind === 'money_relative_to_deal_value') {
      requireExactKeys(entry.normalisation, NORMALISATION_MONEY_KEYS, 'claims[].normalisation');
      const denominatorPrecisionPolicy = moneyDenominatorPrecisionPolicyForClaim(
        contractBundle,
        entry.claimDefinitionKey,
      );
      requireExactKeys(
        entry.normalisation.denominator,
        denominatorPrecisionPolicy ? GOVERNED_DENOMINATOR_KEYS : DENOMINATOR_KEYS,
        'claims[].normalisation.denominator',
      );
      const sourceLineageIds = requireArray(
        entry.normalisation.denominator.sourceLineageExcerptKeys,
        'claims[].normalisation.denominator.sourceLineageExcerptKeys',
      ).map((excerptKey, index) => lookup(
        excerptsRegistry, excerptKey, `claims[].normalisation.denominator.sourceLineageExcerptKeys[${index}]`,
      ).excerpt_id);
      const normalised = normaliseMoneyRelativeToDealValue({
        rawAmount: entry.normalisation.rawAmount,
        currency: entry.normalisation.currency,
        denominator: {
          value: entry.normalisation.denominator.value,
          currency: entry.normalisation.denominator.currency,
          basis: entry.normalisation.denominator.basis,
          source_lineage_ids: sourceLineageIds,
          ...(denominatorPrecisionPolicy
            ? { precision: entry.normalisation.denominator.precision }
            : {}),
        },
        derivationVersion: reviewVersion,
      });
      canonicalValue = normalised.canonical_value;
      unit = normalised.canonical_unit;
      denominator = normalised.denominator;
      attributes = {
        basis_key: normalised.basis_key,
        raw_amount: normalised.raw_value.amount,
        raw_currency: normalised.raw_value.currency,
        ...entry.extraAttributes,
        ...(denominatorPrecisionPolicy
          ? { denominator_precision: normalised.denominator.precision }
          : {}),
        normalisation_payload_digest: normalised.normalisation_payload_digest,
      };
    } else if (kind === 'duration_to_days') {
      requireExactKeys(entry.normalisation, NORMALISATION_DURATION_KEYS, 'claims[].normalisation');
      if (Object.keys(entry.extraAttributes).length) {
        throw new TypeError('claims[].extraAttributes must be empty for a duration_to_days claim');
      }
      const normalised = normaliseDurationToDays({
        rawMagnitude: entry.normalisation.rawMagnitude,
        rawUnit: entry.normalisation.rawUnit,
        dayBasis: entry.normalisation.dayBasis,
        trigger: entry.normalisation.trigger,
        derivationVersion: reviewVersion,
      });
      canonicalValue = normalised.canonical_value;
      unit = normalised.canonical_unit;
      dayBasis = normalised.day_basis;
      attributes = {
        basis_key: normalised.basis_key,
        trigger: normalised.trigger,
        raw_magnitude: normalised.raw_value.magnitude,
        raw_unit: normalised.raw_value.unit,
        normalisation_payload_digest: normalised.normalisation_payload_digest,
      };
    } else {
      throw new TypeError(`unknown claims[].normalisation.kind: ${kind}`);
    }

    const scope = buildClaimScope({
      scopeClosureKind: entry.scopeClosureKind,
      evidenceRows,
      subjectOccurrenceId: component.provision_component_id,
    });
    const claim = buildClaimRevision({
      subject_occurrence_id: component.provision_component_id,
      claim_definition_key: entry.claimDefinitionKey,
      ordinal: entry.ordinal,
      state: entry.state,
      raw_value: rawValueExcerpt.exact_text,
      canonical_value: canonicalValue,
      unit,
      day_basis: dayBasis,
      denominator,
      attributes,
      allowed_attributes: Object.keys(attributes),
      evidence: evidenceRows,
      scope,
      extraction_version: reviewVersion,
      normalisation_version: reviewVersion,
      derivation_version: reviewVersion,
    });
    addUnique(registry, entry.key, claim, 'claims[]');
  }
  return registry;
}

function buildRelationships({ reviewVersion, componentsRegistry, excerptsRegistry, relationshipsInput }) {
  const registry = freshRegistry();
  for (const entry of requireArray(relationshipsInput, 'relationships')) {
    requireExactKeys(entry, RELATIONSHIP_KEYS, 'relationships[]');
    requireString(entry.key, 'relationships[].key');
    const { component: sourceComponent } = lookup(componentsRegistry, entry.sourceComponentKey, 'relationships[].sourceComponentKey');
    requireString(entry.relationshipDefinitionKey, 'relationships[].relationshipDefinitionKey');
    requireInteger(entry.ordinal, 'relationships[].ordinal', { min: 0 });
    requireString(entry.state, 'relationships[].state');
    const rawScopeExcerpt = lookup(excerptsRegistry, entry.rawScopeExcerptKey, 'relationships[].rawScopeExcerptKey');
    const targetOccurrenceIds = requireArray(entry.targetComponentKeys, 'relationships[].targetComponentKeys')
      .map((targetKey, index) => lookup(
        componentsRegistry, targetKey, `relationships[].targetComponentKeys[${index}]`,
      ).component.provision_component_id);
    requirePlainObject(entry.effect, 'relationships[].effect');
    const evidenceRows = resolveEvidenceList(entry.evidence, excerptsRegistry, 'relationships[].evidence');
    const targetIntervalIds = requireArray(entry.targetIntervalExcerptKeys, 'relationships[].targetIntervalExcerptKeys')
      .map((excerptKey, index) => lookup(
        excerptsRegistry, excerptKey, `relationships[].targetIntervalExcerptKeys[${index}]`,
      ).excerpt_id);
    const requiredIds = [...new Set(evidenceRows.map((row) => row.excerpt_id))].sort();
    const scope = {
      scope_closure_id: contentId('RELATIONSHIP_SCOPE_CLOSURE/V1', requiredIds),
      coverage_status: 'COMPLETE',
      required_interval_ids: requiredIds,
      examined_interval_ids: requiredIds,
      target_interval_ids: targetIntervalIds,
    };
    const relationship = buildRelationshipRevision({
      source_occurrence_id: sourceComponent.provision_component_id,
      relationship_definition_key: entry.relationshipDefinitionKey,
      ordinal: entry.ordinal,
      state: entry.state,
      raw_scope: rawScopeExcerpt.exact_text,
      target_occurrence_ids: targetOccurrenceIds,
      effect: entry.effect,
      evidence: evidenceRows,
      scope,
      resolver_version: reviewVersion,
    });
    addUnique(registry, entry.key, relationship, 'relationships[]');
  }
  return registry;
}

function buildResults({
  dealAdmissionId, dealObject, contractBundle, corpusReleaseId, claimsRegistry, relationshipsRegistry, resultsInput,
}) {
  const registry = freshRegistry();
  for (const entry of requireArray(resultsInput, 'results')) {
    requireExactKeys(entry, RESULT_KEYS, 'results[]');
    requireString(entry.key, 'results[].key');
    const claim = lookup(claimsRegistry, entry.claimKey, 'results[].claimKey');
    const relationships = requireArray(entry.relationshipKeys, 'results[].relationshipKeys')
      .map((relKey, index) => lookup(relationshipsRegistry, relKey, `results[].relationshipKeys[${index}]`));
    requireString(entry.resultKey, 'results[].resultKey');
    requireInteger(entry.resultVersion, 'results[].resultVersion', { min: 1 });
    requireString(entry.conceptKey, 'results[].conceptKey');
    requirePlainObject(entry.party, 'results[].party');
    requireString(entry.valueSlotKey, 'results[].valueSlotKey');
    requireInteger(entry.ordinal, 'results[].ordinal', { min: 0 });
    requireString(entry.completeness, 'results[].completeness');
    requireString(entry.comparability, 'results[].comparability');
    requireString(entry.metricKey, 'results[].metricKey');

    let compositionScopeClosureId;
    if (entry.compositionScopeClosureShape === 'claim_and_relationships') {
      compositionScopeClosureId = contentId('COMPOSITION_SCOPE_CLOSURE/V1', {
        claim_revision_id: claim.claim_revision_id,
        relationship_revision_ids: relationships.map((row) => row.relationship_revision_id).sort(),
      });
    } else if (entry.compositionScopeClosureShape === 'claim_scalar') {
      if (relationships.length) {
        throw new TypeError('results[].compositionScopeClosureShape "claim_scalar" cannot carry relationships silently');
      }
      compositionScopeClosureId = contentId('COMPOSITION_SCOPE_CLOSURE/V1', claim.claim_revision_id);
    } else {
      throw new TypeError(`unknown results[].compositionScopeClosureShape: ${entry.compositionScopeClosureShape}`);
    }

    const result = buildFixtureResultComponent({
      deal_admission_id: dealAdmissionId,
      result_key: entry.resultKey,
      result_version: entry.resultVersion,
      concept_key: entry.conceptKey,
      party: entry.party,
      value_slot_key: entry.valueSlotKey,
      ordinal: entry.ordinal,
      claim,
      relationships,
      composition_scope_closure_id: compositionScopeClosureId,
      completeness: entry.completeness,
      comparability: entry.comparability,
    });
    const projection = projectMarketMetricSlot({
      contract_bundle: contractBundle,
      release_state: 'CANDIDATE_CERTIFIED',
      corpus_release_id: corpusReleaseId,
      deal: dealObject,
      concept_key: entry.conceptKey,
      metric_key: entry.metricKey,
      party: entry.party,
      result,
      claim,
      relationships,
      value_slot_key: entry.valueSlotKey,
      ordinal: entry.ordinal,
    });
    addUnique(registry, entry.key, { result, projection }, 'results[]');
  }
  return registry;
}

function buildServingRows({ contractBundle, reviewedMappingId, resultsRegistry, servingRowsInput }) {
  const registry = freshRegistry();
  const frozenPairId = contentId('FROZEN_PAIR/V1', {
    reviewed_mapping_id: reviewedMappingId,
    contract_fingerprint: contractBundle.fingerprint,
  });
  for (const entry of requireArray(servingRowsInput, 'servingRows')) {
    requireExactKeys(entry, SERVING_ROW_KEYS, 'servingRows[]');
    requireString(entry.key, 'servingRows[].key');
    const { projection } = lookup(resultsRegistry, entry.resultKey, 'servingRows[].resultKey');
    requireDigest(entry.servingNamespaceId, 'servingRows[].servingNamespaceId');
    requireInteger(entry.resultOrdinal, 'servingRows[].resultOrdinal', { min: 0 });
    const observation = projection.observation;
    if (!observation) throw new TypeError(`servingRows[] result "${entry.resultKey}" has no comparable observation to serve`);
    const request = {
      serving_namespace_id: entry.servingNamespaceId,
      corpus_release_id: observation.corpus_release_id,
      contract_fingerprint: contractBundle.fingerprint,
      metric_key: observation.metric_key,
      metric_version: observation.metric_version,
      concept_key: observation.concept_key,
      party: observation.party,
      subject_deal_key: observation.deal_key,
      filters: {},
    };
    const compiled = compileMarketCohortRequest(request);
    const cohortResult = {
      schema_version: 'MARKET_COHORT_RESULT/V1',
      serving_namespace_id: compiled.serving_namespace_id,
      corpus_release_id: compiled.corpus_release_id,
      contract_fingerprint: compiled.contract_fingerprint,
      cohort_digest: compiled.cohort_digest,
      metric_key: compiled.metric_key,
      metric_version: compiled.metric_version,
      concept_key: compiled.concept_key,
      subject_deal_key: compiled.subject_deal_key,
      counts: {
        eligible_deals: 1,
        applicable_deals: 1,
        examined_deals: 1,
        present_deals: 1,
        comparable_deals: 1,
        distribution_deals: 1,
        excluded_deals: 0,
        observation_slots: 1,
        excluded_slots: 0,
      },
      distribution: [{ canonical_value: observation.canonical_value, subject_count: 1, deal_count: 1 }],
      exclusions: [],
    };
    const row = buildCanonicalResultServingRow({
      contract_bundle: contractBundle,
      frozen_pair_id: frozenPairId,
      projection_output: projection,
      cohort_request: request,
      cohort_result: cohortResult,
      result_ordinal: entry.resultOrdinal,
    });
    addUnique(registry, entry.key, row, 'servingRows[]');
  }
  return registry;
}

function buildReviewedSlice(input) {
  requireExactKeys(input, TOP_LEVEL_KEYS, 'input');

  const dealKey = requireString(input.dealKey, 'dealKey');
  const dealAdmissionSeed = requireString(input.dealAdmissionSeed, 'dealAdmissionSeed');
  const reviewVersion = requireString(input.reviewVersion, 'reviewVersion');
  const corpusReleaseId = requireDigest(input.corpusReleaseId, 'corpusReleaseId');
  const contractBundle = requirePlainObject(input.contractBundle, 'contractBundle');
  requireDigest(contractBundle.fingerprint, 'contractBundle.fingerprint');

  requireExactKeys(input.deal, ['dimensions'], 'deal');
  requirePlainObject(input.deal.dimensions, 'deal.dimensions');

  requireExactKeys(input.semanticClosure, SEMANTIC_CLOSURE_KEYS, 'semanticClosure');
  if (!['singular', 'plural'].includes(input.semanticClosure.admissionFieldStyle)) {
    throw new TypeError('semanticClosure.admissionFieldStyle must be "singular" or "plural"');
  }
  if (typeof input.semanticClosure.includeComponentIds !== 'boolean') {
    throw new TypeError('semanticClosure.includeComponentIds must be a boolean');
  }

  if (!['plural_sources', 'singular_source'].includes(input.canonicalWriteSetShape)) {
    throw new TypeError('canonicalWriteSetShape must be "plural_sources" or "singular_source"');
  }

  requireExactKeys(input.reviewedMapping, REVIEWED_MAPPING_KEYS, 'reviewedMapping');
  requireString(input.reviewedMapping.primarySourceKey, 'reviewedMapping.primarySourceKey');
  if (input.reviewedMapping.structuralSectionProposalIds !== null) {
    requireArray(input.reviewedMapping.structuralSectionProposalIds, 'reviewedMapping.structuralSectionProposalIds')
      .forEach((id, index) => requireDigest(id, `reviewedMapping.structuralSectionProposalIds[${index}]`));
  }
  const governedEvidenceExcerptKeys = requireArray(
    input.reviewedMapping.governedEvidenceExcerptKeys, 'reviewedMapping.governedEvidenceExcerptKeys',
  );

  const dealAdmissionId = contentId('DEAL_ADMISSION/V1', dealAdmissionSeed);

  const sourcesRegistry = buildSources({ dealKey, dealAdmissionId, contractBundle, sourcesInput: input.sources });
  const spansRegistry = buildSpans({ sourcesRegistry, spansInput: input.spans });
  const excerptsRegistry = buildExcerpts({ sourcesRegistry, spansRegistry, excerptsInput: input.excerpts });
  const provisionsRegistry = buildProvisions({
    sourcesRegistry,
    spansRegistry,
    provisionsInput: input.provisions,
    contractBundle,
  });
  const componentsRegistry = buildComponents({
    sourcesRegistry,
    spansRegistry,
    provisionsRegistry,
    componentsInput: input.components,
    contractBundle,
  });
  const claimsRegistry = buildClaims({
    reviewVersion,
    contractBundle,
    componentsRegistry,
    excerptsRegistry,
    claimsInput: input.claims,
  });
  const relationshipsRegistry = buildRelationships({
    reviewVersion, componentsRegistry, excerptsRegistry, relationshipsInput: input.relationships,
  });

  const primarySource = lookup(sourcesRegistry, input.reviewedMapping.primarySourceKey, 'reviewedMapping.primarySourceKey').source;
  const dealObject = {
    deal_key: dealKey,
    deal_admission_id: dealAdmissionId,
    document_hash: primarySource.document_hash,
    dimensions: input.deal.dimensions,
  };

  const resultsRegistry = buildResults({
    dealAdmissionId,
    dealObject,
    contractBundle,
    corpusReleaseId,
    claimsRegistry,
    relationshipsRegistry,
    resultsInput: input.results,
  });

  const provisionIds = [...provisionsRegistry.values()].map((row) => row.provision.provision_instance_id);
  const componentIds = [...componentsRegistry.values()].map((row) => row.component.provision_component_id);
  const claimIds = [...claimsRegistry.values()].map((claim) => claim.claim_revision_id);
  const relationshipIds = [...relationshipsRegistry.values()].map((row) => row.relationship_revision_id);
  const canonicalObjectIds = [...provisionIds, ...componentIds, ...claimIds, ...relationshipIds].sort();
  const governedEvidenceExcerptIds = governedEvidenceExcerptKeys
    .map((excerptKey, index) => lookup(
      excerptsRegistry, excerptKey, `reviewedMapping.governedEvidenceExcerptKeys[${index}]`,
    ).excerpt_id)
    .sort();

  const reviewedMappingBase = {
    schema_version: 'REVIEWED_CANONICAL_MAPPING/V1',
    review_version: reviewVersion,
    document_hash: primarySource.document_hash,
    ...(input.reviewedMapping.structuralSectionProposalIds !== null
      ? { structural_section_proposal_ids: [...input.reviewedMapping.structuralSectionProposalIds].sort() }
      : {}),
    governed_evidence_excerpt_ids: governedEvidenceExcerptIds,
    canonical_object_ids: canonicalObjectIds,
  };
  const reviewedMapping = Object.freeze({
    ...reviewedMappingBase,
    reviewed_mapping_id: contentId('REVIEWED_CANONICAL_MAPPING/V1', reviewedMappingBase),
    canonical_payload_digest: contentId('REVIEWED_CANONICAL_MAPPING_PAYLOAD/V1', reviewedMappingBase),
  });

  const servingRowsRegistry = buildServingRows({
    contractBundle,
    reviewedMappingId: reviewedMapping.reviewed_mapping_id,
    resultsRegistry,
    servingRowsInput: input.servingRows,
  });

  const admissionIds = [...sourcesRegistry.values()].map((row) => row.admission.source_admission_manifest_id);
  const semanticClosurePayload = { review_version: reviewVersion };
  if (input.semanticClosure.admissionFieldStyle === 'singular') {
    if (admissionIds.length !== 1) {
      throw new TypeError('semanticClosure.admissionFieldStyle "singular" requires exactly one admitted source');
    }
    semanticClosurePayload.source_admission_manifest_id = admissionIds[0];
  } else {
    semanticClosurePayload.source_admission_manifest_ids = [...admissionIds].sort();
  }
  semanticClosurePayload.provision_instance_ids = [...provisionIds].sort();
  if (input.semanticClosure.includeComponentIds) {
    semanticClosurePayload.provision_component_ids = [...componentIds].sort();
  }
  const semanticClosureId = contentId('SEMANTIC_CLOSURE/V1', semanticClosurePayload);
  const withClosure = (row) => ({ ...row, closure_id: semanticClosureId });

  const sourcesArray = [...sourcesRegistry.values()].map((row) => row.source);
  const admissionsArray = [...sourcesRegistry.values()].map((row) => row.admission);
  const excerptsArray = [...excerptsRegistry.values()].map(withClosure);
  const provisionsArray = [...provisionsRegistry.values()].map((row) => withClosure(row.provision));
  const componentsArray = [...componentsRegistry.values()].map((row) => withClosure(row.component));
  const claimsArray = [...claimsRegistry.values()].map(withClosure);
  const relationshipsArray = [...relationshipsRegistry.values()].map(withClosure);

  let canonicalWriteSet;
  if (input.canonicalWriteSetShape === 'singular_source') {
    if (sourcesArray.length !== 1) {
      throw new TypeError('canonicalWriteSetShape "singular_source" requires exactly one source');
    }
    canonicalWriteSet = {
      source: sourcesArray[0],
      source_admission: admissionsArray[0],
      deal: dealObject,
      excerpts: excerptsArray,
      provisions: provisionsArray,
      components: componentsArray,
      claims: claimsArray,
      relationships: relationshipsArray,
    };
  } else {
    canonicalWriteSet = {
      sources: sourcesArray,
      source_admissions: admissionsArray,
      deal: dealObject,
      excerpts: excerptsArray,
      provisions: provisionsArray,
      components: componentsArray,
      claims: claimsArray,
      relationships: relationshipsArray,
    };
  }

  return Object.freeze({
    reviewed_mapping: reviewedMapping,
    deal: dealObject,
    sources: Object.fromEntries([...sourcesRegistry].map(([key, row]) => [key, row.source])),
    admissions: Object.fromEntries([...sourcesRegistry].map(([key, row]) => [key, row.admission])),
    spans: Object.fromEntries([...spansRegistry].map(([key, row]) => [key, row.span])),
    excerpts: Object.fromEntries(excerptsRegistry),
    provisions: Object.fromEntries([...provisionsRegistry].map(([key, row]) => [key, row.provision])),
    components: Object.fromEntries([...componentsRegistry].map(([key, row]) => [key, row.component])),
    claims: Object.fromEntries(claimsRegistry),
    relationships: Object.fromEntries(relationshipsRegistry),
    results: Object.fromEntries([...resultsRegistry].map(([key, row]) => [key, { result: row.result, projection: row.projection }])),
    servingRows: Object.fromEntries(servingRowsRegistry),
    canonicalWriteSet,
  });
}

module.exports = { buildReviewedSlice };
