'use strict';

// Cover for the one defect the recovered final M7 edits did not fix, and for the
// readability behaviour they did. Everything here runs against committed inputs.
//
// The recovered REPRESENTATIONS matcher was
//   /\b(?:authority; binding|authorization; valid and binding)\b/i
// which matches no heading in the corpus at all — it bound 0 of 7 agreements.
// The headings it was written for do not occur; the real ones read "Authority;
// No Violations; Consents and Approvals." and "Authority; Execution and
// Delivery; Enforceability.".

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  FAMILY_MATCHERS,
  REVIEW_REASONS,
  SELECTION_MODES,
  applySelectionModeGate,
  selectFamilySections,
  statesNoConflicts,
} = require('../lib/canonical-v2/m7-deterministic-generalisation');
const { projectAgreement, viewPolicyFor } = require('../lib/canonical-v2/agreement-projection');

const ROOT = path.resolve(__dirname, '..', 'evidence/canonical-v2/stage-2y-structure-migration');

function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
}

function familyOrder() {
  return readJson('receipts/stage-2y-structure-m5-preparation.json').family_order;
}

function indexes() {
  const dir = path.join(ROOT, 'shadow/m2');
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith('.agreement-index.json'))
    .sort()
    .map((name) => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')));
}

test('REPRESENTATIONS binds on every agreement in the committed M2 corpus', () => {
  const order = familyOrder();
  const unbound = [];
  for (const index of indexes()) {
    const binding = selectFamilySections(index, order)
      .find((entry) => entry.family_key === 'REPRESENTATIONS');
    if (binding.state !== 'RECORDED_INPUT_BINDING') unbound.push(index.source_binding.deal);
  }
  assert.equal(indexes().length, 7);
  assert.deepEqual(unbound, [], `REPRESENTATIONS unbound on: ${unbound.join(', ')}`);
});

// Five of the seven agreements attribute on the ARTICLE
// ("REPRESENTATIONS AND WARRANTIES OF THE COMPANY") with plain topic headings
// beneath it; redhat and topbuild attribute at section level. Scanning only
// SECTION nodes loses the first shape without saying so.
test('the article backstop is what covers the article-attributed shape', () => {
  const order = familyOrder();
  const matcher = new Map(FAMILY_MATCHERS).get('REPRESENTATIONS');
  let viaArticle = 0;
  for (const index of indexes()) {
    const text = Buffer.from(index.source_binding.canonical_text, 'utf8');
    const byId = new Map(index.nodes.map((node) => [node.node_occurrence_id, node]));
    const heading = (node) => {
      const found = node.child_node_occurrence_ids.map((id) => byId.get(id))
        .find((child) => child?.node_kind === 'HEADING');
      return found ? text.subarray(found.extent_span.start_byte, found.extent_span.end_byte).toString('utf8') : '';
    };
    const sectionMatches = index.nodes.some((node) => node.node_kind === 'SECTION'
      && node.extent_span.end_byte - node.extent_span.start_byte >= 100
      && matcher.test(heading(node)));
    if (!sectionMatches) {
      viaArticle += 1;
      const binding = selectFamilySections(index, order)
        .find((entry) => entry.family_key === 'REPRESENTATIONS');
      assert.equal(binding.state, 'RECORDED_INPUT_BINDING',
        `${index.source_binding.deal} has no matching section and must bind through its article`);
    }
  }
  assert.equal(viaArticle, 5, 'five agreements in this corpus attribute on the article');
});

test('a matching section still outranks the article that contains it', () => {
  const order = familyOrder();
  const byId = (index) => new Map(index.nodes.map((node) => [node.node_occurrence_id, node]));
  for (const index of indexes()) {
    const binding = selectFamilySections(index, order)
      .find((entry) => entry.family_key === 'REPRESENTATIONS');
    const node = byId(index).get(binding.source_node_occurrence_id);
    assert.notEqual(node.node_kind, 'ARTICLE',
      'an article must resolve to an authored unit, never stand as one comparison item');
    assert.notEqual(node.node_kind, 'SECTION');
  }
});

test('the matcher excludes the phrase that also heads survival and non-reliance', () => {
  const matcher = new Map(FAMILY_MATCHERS).get('REPRESENTATIONS');
  assert.equal(matcher.test('Survival of Representations and Warranties'), false);
  assert.equal(matcher.test('No Other Representations and Warranties'), false);
  assert.equal(matcher.test('REPRESENTATIONS AND WARRANTIES OF THE COMPANY'), true);
  assert.equal(matcher.test('Representations and Warranties of Parent and Sub.'), true);
});

// The recovered readability edits, pinned against real projected rows so a
// future change cannot quietly undo them. 1,111 rows is the sealed M6 count.
test('every projected row leads with Rule and caps its actor list', () => {
  const viewPolicy = viewPolicyFor(familyOrder());
  const dir = path.join(ROOT, 'shadow/m5-correction/analysis');
  let rows = 0;
  for (const name of fs.readdirSync(dir).filter((entry) => entry.endsWith('.agreement-analysis.json'))) {
    const projection = projectAgreement(JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')), viewPolicy);
    for (const row of projection.rows) {
      rows += 1;
      const expanded = row.fields.find((field) => field.field_key === 'expanded_text').value;
      assert.ok(expanded.startsWith('Rule:'), `row ${row.row_id} does not lead with Rule`);
      const applies = expanded.split('\n').find((line) => line.startsWith('Applies to: '));
      if (applies) {
        assert.ok(applies.replace('Applies to: ', '').split('; ').length <= 2,
          `row ${row.row_id} lists more than two actors — the withdrawn packet listed eleven`);
      }
    }
  }
  assert.equal(rows, 1111);
});

// --- selection diagnostic and the review gate --------------------------------

test('every binding records how its authored unit was chosen', () => {
  const order = familyOrder();
  const modes = new Set();
  for (const index of indexes()) {
    for (const entry of selectFamilySections(index, order)) {
      if (entry.state === 'RECORDED_INPUT_BINDING') {
        assert.ok(Object.values(SELECTION_MODES).includes(entry.selection_mode),
          `${index.source_binding.deal}/${entry.family_key} has no selection mode`);
        modes.add(entry.selection_mode);
      } else {
        assert.equal(entry.selection_mode, null, 'an unbound family records no selection mode');
      }
    }
  }
  // Both outcomes occur in this corpus, so neither branch is untested.
  assert.ok(modes.has(SELECTION_MODES.AUTHORED_UNIT_MATCH));
  assert.ok(modes.has(SELECTION_MODES.DOCUMENT_ORDER_FALLBACK));
});

test('a document-order fallback is reviewable, never a normal comparison row', () => {
  const proposition = (id, nodeId, familyKey) => ({
    schema_version: 'STAGE_2Y_M5_COMPOUND_PROPOSITION/V1',
    compound_proposition_id: id,
    family_key: familyKey,
    source_node_occurrence_ids: [nodeId],
    proposition_validation_state: 'COMPLETE',
    missing_required_roles: [],
    diagnostic_codes: [],
    projection_eligibility: 'ELIGIBLE',
  });
  const gated = applySelectionModeGate([
    { family_key: 'A', selection_mode: SELECTION_MODES.DOCUMENT_ORDER_FALLBACK, source_node_occurrence_id: 'node-fallback' },
    { family_key: 'B', selection_mode: SELECTION_MODES.AUTHORED_UNIT_MATCH, source_node_occurrence_id: 'node-matched' },
  ], [proposition('a', 'node-fallback', 'A'), proposition('b', 'node-matched', 'B')]);

  const [fallback, matched] = gated;
  assert.equal(fallback.proposition_validation_state, 'MISSING_REQUIRED_ROLE');
  assert.equal(fallback.projection_eligibility, 'BLOCKED');
  assert.ok(fallback.missing_required_roles.includes('FAMILY_MATCHED_AUTHORED_UNIT'));
  assert.ok(fallback.diagnostic_codes.includes('M7_DOCUMENT_ORDER_FALLBACK_SELECTION'));
  assert.notEqual(fallback.compound_proposition_id, 'a', 'gating must re-derive the identity');

  assert.equal(matched.proposition_validation_state, 'COMPLETE');
  assert.equal(matched.compound_proposition_id, 'b', 'a matched selection is untouched');
});

test('the gate routes to review through the same door partials already use', () => {
  const { projectAgreement, viewPolicyFor } = require('../lib/canonical-v2/agreement-projection');
  const viewPolicy = viewPolicyFor(familyOrder());
  const dir = path.join(ROOT, 'shadow/m5-correction/analysis');
  const name = fs.readdirSync(dir).filter((entry) => entry.endsWith('.agreement-analysis.json')).sort()[0];
  const analysis = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
  const target = analysis.compound_propositions.find((entry) => entry.proposition_validation_state === 'COMPLETE');
  const gated = applySelectionModeGate(
    [{ family_key: target.family_key, selection_mode: SELECTION_MODES.DOCUMENT_ORDER_FALLBACK, source_node_occurrence_id: target.source_node_occurrence_ids[0], review_required_reason: null }],
    analysis.compound_propositions,
  );
  const projection = projectAgreement({ ...analysis, compound_propositions: gated }, viewPolicy);
  assert.equal(projection.rows.some((row) => row.source_compound_proposition_id === target.compound_proposition_id), false,
    'the fallback proposition must not appear as a normal row');
  assert.ok(projection.review_rows.some((row) => row.missing_required_roles.includes('FAMILY_MATCHED_AUTHORED_UNIT')),
    'it must appear in the review lane with the reason stated');
});

// --- family-specific selection rules -----------------------------------------

test('REPRESENTATIONS binds the no-conflicts representation', () => {
  const order = familyOrder();
  for (const index of indexes()) {
    const binding = selectFamilySections(index, order)
      .find((entry) => entry.family_key === 'REPRESENTATIONS');
    const text = Buffer.from(index.source_binding.canonical_text, 'utf8')
      .subarray(binding.source_span.start_byte, binding.source_span.end_byte).toString('utf8');
    assert.ok(statesNoConflicts(text),
      `${index.source_binding.deal} did not bind a no-conflicts representation`);
    assert.equal(binding.selection_mode, SELECTION_MODES.AUTHORED_UNIT_MATCH);
    assert.equal(binding.review_required_reason, null);
  }
});

test('the governing chapeau is carried as inherited context, not as the proposition', () => {
  const order = familyOrder();
  for (const index of indexes()) {
    const binding = selectFamilySections(index, order)
      .find((entry) => entry.family_key === 'REPRESENTATIONS');
    assert.ok(binding.context_chapeau_node_occurrence_id,
      `${index.source_binding.deal} has no governing chapeau linked`);
    assert.notEqual(binding.context_chapeau_node_occurrence_id, binding.source_node_occurrence_id,
      'the chapeau is context; it is never the bound unit itself');
    assert.ok(binding.context_chapeau_span.start_byte <= binding.source_span.start_byte,
      'the governing chapeau must open at or before the unit it governs');
  }
});

test('no family other than REPRESENTATIONS may bind through an article heading', () => {
  const order = familyOrder();
  for (const index of indexes()) {
    const text = Buffer.from(index.source_binding.canonical_text, 'utf8');
    const byId = new Map(index.nodes.map((node) => [node.node_occurrence_id, node]));
    const inArticleOnly = (binding) => {
      let node = byId.get(binding.source_node_occurrence_id);
      while (node) {
        if (node.node_kind === 'SECTION') return false;
        node = byId.get(node.parent_node_occurrence_id);
      }
      return true;
    };
    for (const binding of selectFamilySections(index, order)) {
      if (binding.state !== 'RECORDED_INPUT_BINDING') continue;
      if (binding.family_key === 'REPRESENTATIONS') continue;
      assert.equal(inArticleOnly(binding), false,
        `${index.source_binding.deal}/${binding.family_key} bound under an article with no section between`);
    }
    assert.ok(text.length > 0);
  }
});

test('SkyWater CONSIDERATION stays unbound rather than binding a mechanic', () => {
  const order = familyOrder();
  const skywater = indexes().find((index) => index.source_binding.deal === 'skywater');
  const binding = selectFamilySections(skywater, order)
    .find((entry) => entry.family_key === 'CONSIDERATION');
  assert.equal(binding.state, 'INPUT_NOT_AVAILABLE',
    'an article-level "exchange of certificates" heading must not bind the exchange-agent mechanic');
});

test('a disclosure chapeau alone is never a complete comparison proposition', () => {
  const gated = applySelectionModeGate(
    [{
      family_key: 'REPRESENTATIONS',
      selection_mode: SELECTION_MODES.AUTHORED_UNIT_MATCH,
      source_node_occurrence_id: 'chapeau-node',
      review_required_reason: REVIEW_REASONS.DISCLOSURE_CHAPEAU_ONLY,
    }],
    [{
      schema_version: 'STAGE_2Y_M5_COMPOUND_PROPOSITION/V1',
      compound_proposition_id: 'x',
      family_key: 'REPRESENTATIONS',
      source_node_occurrence_ids: ['chapeau-node'],
      proposition_validation_state: 'COMPLETE',
      missing_required_roles: [],
      diagnostic_codes: [],
      projection_eligibility: 'ELIGIBLE',
    }],
  );
  assert.equal(gated[0].proposition_validation_state, 'MISSING_REQUIRED_ROLE');
  assert.ok(gated[0].missing_required_roles.includes('SUBSTANTIVE_LEGAL_UNIT'));
  assert.ok(gated[0].diagnostic_codes.includes('M7_DISCLOSURE_CHAPEAU_ONLY'));
});

test('the gate keys on family and node together, not the node alone', () => {
  const shared = 'shared-node';
  const base = (id, familyKey) => ({
    schema_version: 'STAGE_2Y_M5_COMPOUND_PROPOSITION/V1',
    compound_proposition_id: id,
    family_key: familyKey,
    source_node_occurrence_ids: [shared],
    proposition_validation_state: 'COMPLETE',
    missing_required_roles: [],
    diagnostic_codes: [],
    projection_eligibility: 'ELIGIBLE',
  });
  const gated = applySelectionModeGate(
    [{ family_key: 'TERMINATION', selection_mode: SELECTION_MODES.DOCUMENT_ORDER_FALLBACK, source_node_occurrence_id: shared, review_required_reason: null },
      { family_key: 'TERMINATION_FEE', selection_mode: SELECTION_MODES.AUTHORED_UNIT_MATCH, source_node_occurrence_id: shared, review_required_reason: null }],
    [base('a', 'TERMINATION'), base('b', 'TERMINATION_FEE')],
  );
  assert.equal(gated[0].proposition_validation_state, 'MISSING_REQUIRED_ROLE', 'the fallback family is gated');
  assert.equal(gated[1].proposition_validation_state, 'COMPLETE',
    'a different family sharing the same authored unit must not be dragged into review');
});

// --- one authored sentence is one legal unit ---------------------------------

function unitText(index, unit) {
  return Buffer.from(index.source_binding.canonical_text, 'utf8')
    .subarray(unit.source_span.start_byte, unit.source_span.end_byte)
    .toString('utf8')
    .replace(/\s+/g, ' ')
    .trim();
}

test('a container states as many rules as it has sentences', () => {
  const order = familyOrder();
  let total = 0;
  for (const index of indexes()) {
    const binding = selectFamilySections(index, order)
      .find((entry) => entry.family_key === 'REPRESENTATIONS');
    assert.ok(binding.authored_units.length >= 1, 'a bound family states at least one rule');
    total += binding.authored_units.length;
  }
  // Every agreement here writes no-conflicts as a single formula covering all
  // the obligated entities, so the per-sentence machinery yields one unit each.
  // It still matters: it is what keeps a sub-heading out of the rule, and what
  // would carry modiv's Company / Partnership / Subsidiary split if the bound
  // representation were written per entity, as organisation and existence is.
  assert.equal(total, 7);
});

test('no rule text opens with a sub-heading label', () => {
  const order = familyOrder();
  for (const index of indexes()) {
    const binding = selectFamilySections(index, order)
      .find((entry) => entry.family_key === 'REPRESENTATIONS');
    for (const unit of binding.authored_units) {
      assert.doesNotMatch(unitText(index, unit), /^\([a-z0-9]+\)\s+[A-Z][^.]{0,60}\.\s+[A-Z]/,
        `a sub-heading is being read as part of the rule: ${unitText(index, unit).slice(0, 80)}`);
    }
  }
});

test('every unit states the representation its container was selected for', () => {
  const order = familyOrder();
  for (const index of indexes()) {
    const binding = selectFamilySections(index, order)
      .find((entry) => entry.family_key === 'REPRESENTATIONS');
    for (const unit of binding.authored_units) {
      // A container can be wider than the provision that matched it, so units
      // are filtered by the same test that selected it.
      assert.ok(statesNoConflicts(unitText(index, unit)),
        `off-topic sentence bound as a representation: ${unitText(index, unit).slice(0, 90)}`);
    }
  }
});

test('a chapeau that states the rule is not treated as a disclosure chapeau', () => {
  const order = familyOrder();
  const metsera = indexes().find((index) => index.source_binding.deal === 'metsera');
  const binding = selectFamilySections(metsera, order)
    .find((entry) => entry.family_key === 'REPRESENTATIONS');
  // metsera writes no-conflicts as a chapeau introducing enumerated limbs.
  assert.equal(binding.authored_units[0].node_kind, 'CHAPEAU');
  assert.equal(binding.review_required_reason, null,
    'an operative chapeau states a rule and must not be routed to review');
  assert.ok(binding.context_chapeau_node_occurrence_id,
    'it still sits under the disclosure chapeau, which stays linked as context');
});

test('the container and its chapeau stay reachable as evidence', () => {
  const order = familyOrder();
  for (const index of indexes()) {
    const binding = selectFamilySections(index, order)
      .find((entry) => entry.family_key === 'REPRESENTATIONS');
    assert.ok(binding.source_node_occurrence_id, 'the container is recorded');
    assert.ok(binding.context_chapeau_node_occurrence_id, 'the governing chapeau is recorded');
    for (const unit of binding.authored_units) {
      assert.ok(unit.source_span.start_byte >= binding.source_span.start_byte
        && unit.source_span.end_byte <= binding.source_span.end_byte,
      'every unit lies inside the container that is cited as its evidence');
    }
  }
});

test('a sentence the filter excludes is named, not silently absent', () => {
  const order = familyOrder();
  let bound = 0;
  let setAside = 0;
  for (const index of indexes()) {
    const binding = selectFamilySections(index, order)
      .find((entry) => entry.family_key === 'REPRESENTATIONS');
    bound += binding.authored_units.length;
    setAside += binding.set_aside_units.length;
    for (const unit of binding.set_aside_units) {
      assert.equal(unit.reason, 'DOES_NOT_STATE_THE_BOUND_RULE');
      assert.ok(unit.node_occurrence_id && unit.source_span,
        'a set-aside sentence keeps its identity and span so it can be found again');
      assert.ok(!binding.authored_units.some((kept) => kept.node_occurrence_id === unit.node_occurrence_id),
        'a sentence is either bound or set aside, never both');
    }
  }
  // redhat's container bundles the authority, board-authorisation,
  // enforceability, board-approval and governmental-consents representations
  // alongside no-conflicts; topbuild's adds HSR filings, no-Default and the
  // board recommendation. Nine genuine representations in total, excluded from
  // this binding and recorded rather than discarded.
  assert.equal(bound, 7);
  assert.equal(setAside, 9);
});
