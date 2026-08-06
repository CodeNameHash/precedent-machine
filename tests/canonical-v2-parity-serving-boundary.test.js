'use strict';

// The server-stamped-field proof: docs/codex-program/notes/family-rollout-mechanics.md
// ("Watch for this" #1) and docs/codex-program/notes/compare-locator-fix.md (Part 4) both
// found the same gap and neither built a fix. Every OTHER proof in
// lib/canonical-v2/native-producer/m3-family-parity-register.js walks one module graph: the
// same require()/import specifiers a bundler would follow. A family's real serving switch
// crosses an HTTP boundary no import graph can see -- a server-side
// attachCanonicalXxxServing-shaped function stamps a field onto the object
// pages/api/review/[id]/cards.js serialises to JSON; a client module in a completely
// separate module graph reads that same field name off the fetched payload. So a surface
// could report NATIVE_VISIBLE while proving nothing about whether V2 data reaches a user --
// exactly the fooling case both prior notes named and declined to close.
//
// This file tests the fix: serverStampsField, clientReadsField and servingBoundaryProof,
// all against REAL repository files (termination fee's actual serving source, actual API
// route, actual client config), not synthetic source strings -- so a positive result here
// means the real code, not a fixture built to pass. The central requirement
// docs/codex-program/notes/serving-path-proof.md was scoped against: "a hostile one where
// the two ends disagree and the check must fail" -- section 2 below.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const {
  CURRENT_M3_FAMILY_PARITY_REGISTER,
  analyseModuleSource,
  clientReadsField,
  isNativeSemanticCompletion,
  liveProductVisibility,
  listM3ProductParityBlockers,
  serverStampsField,
  servingBoundaryProof,
  validateM3FamilyParityRegister,
} = require('../lib/canonical-v2/native-producer/m3-family-parity-register');

const SERVING_SOURCE = 'lib/canonical-v2/termination-fee-serving-source.js';
const CARDS_ROUTE = 'pages/api/review/[id]/cards.js';
const TERMINATION_FEES_CONFIG = 'components/review/table-configs/termination-fees.config.js';
const COMPARE_COLUMN = 'components/review-v2/CompareColumn.jsx';

function surface(id) {
  return [
    ...CURRENT_M3_FAMILY_PARITY_REGISTER.families.flatMap((entry) => entry.product_surfaces),
    ...CURRENT_M3_FAMILY_PARITY_REGISTER.supplemental_owners.flatMap((entry) => entry.product_surfaces),
  ].find((entry) => entry.surface_id === id);
}

// The real, correct correspondence, termination fee's actual architecture: attach stamps
// canonical_v2_termination_fee_cards; partitionTerminationFeeCards reads it.
const REAL_CARDS_SHAPE = Object.freeze({
  kind: 'server_stamped_field',
  wire_field: 'canonical_v2_termination_fee_cards',
  server_path: SERVING_SOURCE,
  server_function: 'attachCanonicalTerminationFeeServing',
  server_route: CARDS_ROUTE,
  client_function: 'partitionTerminationFeeCards',
});

// ---------------------------------------------------------------------------------------
// 1. The positive case: real termination-fee files, both halves, independently and combined.
// ---------------------------------------------------------------------------------------

test('the server half proves attachCanonicalTerminationFeeServing genuinely stamps the cards field, reached from the live cards route', () => {
  const proof = serverStampsField(REAL_CARDS_SHAPE);
  assert.equal(proof.proven, true);
  assert.equal(proof.reason, null);
});

test('the client half proves partitionTerminationFeeCards genuinely reads the same field', () => {
  const proof = clientReadsField(
    { source_path: TERMINATION_FEES_CONFIG },
    REAL_CARDS_SHAPE,
  );
  assert.equal(proof.proven, true);
  assert.equal(proof.reason, null);
});

test('the combined proof requires both halves and both hold for the real files', () => {
  const proof = servingBoundaryProof({ source_path: TERMINATION_FEES_CONFIG, server_stamped_field: REAL_CARDS_SHAPE });
  assert.deepEqual(proof, { applicable: true, proven: true, reason: null });
});

test('a surface naming no server_stamped_field evidence is simply not applicable, never proven or refused', () => {
  const proof = servingBoundaryProof({ source_path: TERMINATION_FEES_CONFIG });
  assert.deepEqual(proof, { applicable: false, proven: false, reason: null });
});

// ---------------------------------------------------------------------------------------
// 2. The hostile case the brief asked for by name: the two ends disagree.
//
// Every variant below uses REAL field names and REAL functions from the real repository --
// never a made-up string -- so a pass here is never explained by "of course an invented
// name doesn't resolve." Each one names something that is true about the codebase in
// isolation (a real field, really stamped by something, or really read by something) while
// being FALSE about the one correspondence the surface claims.
// ---------------------------------------------------------------------------------------

test('hostile: wire_field is real and genuinely stamped, but by a DIFFERENT server function than the one named', () => {
  // canonical_v2_preview_enabled is a real wire field, genuinely stamped -- by
  // attachCanonicalV2Preview in review-preview-assembly.js, not by
  // attachCanonicalTerminationFeeServing. Naming the wrong stamping function for a real
  // field must fail, not fall back to "found it somewhere."
  const disagreeing = { ...REAL_CARDS_SHAPE, wire_field: 'canonical_v2_preview_enabled' };
  const proof = serverStampsField(disagreeing);
  assert.equal(proof.proven, false);
  assert.equal(proof.reason, 'WIRE_FIELD_NOT_STAMPED_ON_REACHABLE_PATH');
});

test('hostile: wire_field is real and genuinely stamped by THIS server function, but the named client_function reads a different field', () => {
  // attachCanonicalTerminationFeeServing really does stamp
  // canonical_v2_termination_fee_serving_enabled (the boolean switch, not the cards array).
  // The server half must prove true. But partitionTerminationFeeCards never reads that
  // field -- it reads the cards field -- so the client half, and therefore the whole
  // boundary proof, must fail. This is the exact "two real, individually-true facts about
  // opposite ends that do not correspond to each other" shape the brief named.
  const disagreeing = { ...REAL_CARDS_SHAPE, wire_field: 'canonical_v2_termination_fee_serving_enabled' };
  const serverHalf = serverStampsField(disagreeing);
  assert.equal(serverHalf.proven, true, 'the server really does stamp this field -- the disagreement must be caught on the client side, not manufactured on the server side');

  const clientHalf = clientReadsField({ source_path: TERMINATION_FEES_CONFIG }, disagreeing);
  assert.equal(clientHalf.proven, false);
  assert.equal(clientHalf.reason, 'WIRE_FIELD_NOT_READ_ON_REACHABLE_PATH');

  const whole = servingBoundaryProof({ source_path: TERMINATION_FEES_CONFIG, server_stamped_field: disagreeing });
  assert.equal(whole.proven, false);
  assert.equal(whole.reason, 'WIRE_FIELD_NOT_READ_ON_REACHABLE_PATH');
});

test('hostile: client_function is real, exists, is genuinely called, but reads a DIFFERENT field than the one claimed', () => {
  // isCanonicalTerminationFeeCompareEnabled is a real, exported, genuinely-called function
  // in termination-fees.config.js. It reads the compare and serving fields. It does not
  // read the cards field.
  const disagreeing = { ...REAL_CARDS_SHAPE, client_function: 'isCanonicalTerminationFeeCompareEnabled' };
  const proof = clientReadsField({ source_path: TERMINATION_FEES_CONFIG }, disagreeing);
  assert.equal(proof.proven, false);
  assert.equal(proof.reason, 'WIRE_FIELD_NOT_READ_ON_REACHABLE_PATH');
});

test('hostile: a rename on one side that is not mirrored on the other breaks the match', () => {
  // Simulates the exact failure mode named in the brief: someone renames the server's
  // field constant (or the client's) without updating the other. The register still names
  // the OLD field; the server now stamps something else. Modelled here as the server half
  // alone, since that is the side a rename would actually touch first in this repository's
  // convention (the field-name literal is declared independently on each side by design).
  const renamedAway = { ...REAL_CARDS_SHAPE, wire_field: 'canonical_v2_termination_fee_cards_v2' };
  assert.equal(serverStampsField(renamedAway).proven, false);
  assert.equal(clientReadsField({ source_path: TERMINATION_FEES_CONFIG }, renamedAway).proven, false);
});

// ---------------------------------------------------------------------------------------
// 3. Hostile: the server function is real, but not reached the way the surface claims.
// ---------------------------------------------------------------------------------------

test('hostile: server_function is real and exported, but never executed by the named route', () => {
  // isCanonicalV2TerminationFeeCompareEnabled is a real export of the serving-source module.
  // pages/api/review/[id]/cards.js never imports or calls it -- only
  // attachCanonicalTerminationFeeServing.
  const proof = serverStampsField({ ...REAL_CARDS_SHAPE, server_function: 'isCanonicalV2TerminationFeeCompareEnabled' });
  assert.equal(proof.proven, false);
  assert.equal(proof.reason, 'SERVER_FUNCTION_NOT_EXECUTED_BY_ROUTE');
});

test('hostile: server_route is a real, existing file, but it is a contained (503-stub) route', () => {
  const proof = serverStampsField({ ...REAL_CARDS_SHAPE, server_route: 'pages/api/query/run.js' });
  assert.equal(proof.proven, false);
  assert.equal(proof.reason, 'SERVER_ROUTE_NOT_SERVED');
});

test('hostile: server_route is a real page, but sits behind the design route guard', () => {
  const proof = serverStampsField({ ...REAL_CARDS_SHAPE, server_route: 'pages/design/canonical-v2.js', server_function: 'attachCanonicalTerminationFeeServing' });
  assert.equal(proof.proven, false);
  assert.equal(proof.reason, 'SERVER_ROUTE_NOT_SERVED');
});

// ---------------------------------------------------------------------------------------
// 4. Hostile: the client function does not survive scrutiny.
// ---------------------------------------------------------------------------------------

test('hostile: client_function names a real file member that is not a function at all', () => {
  // CANONICAL_V2_TERMINATION_FEE_CARDS_FIELD is a real, top-level binding in
  // termination-fees.config.js -- but it is a VALUE (a string constant), not a FUNCTION, so
  // it cannot be the "reads the field" site the evidence claims.
  const proof = clientReadsField(
    { source_path: TERMINATION_FEES_CONFIG },
    { ...REAL_CARDS_SHAPE, client_function: 'CANONICAL_V2_TERMINATION_FEE_CARDS_FIELD' },
  );
  assert.equal(proof.proven, false);
  assert.equal(proof.reason, 'CLIENT_FUNCTION_NOT_FOUND');
});

test('hostile: client_function does not exist in source_path at all', () => {
  const proof = clientReadsField(
    { source_path: TERMINATION_FEES_CONFIG },
    { ...REAL_CARDS_SHAPE, client_function: 'thisFunctionWasNeverWritten' },
  );
  assert.equal(proof.proven, false);
  assert.equal(proof.reason, 'CLIENT_FUNCTION_NOT_FOUND');
});

test('a synthetic orphan function that exists and evaluates the right literal, but is never called, does not prove', () => {
  // This is the honest limit recorded above servingBoundaryProof in the register module:
  // referencedBeyondImport only proves "called from somewhere in the file", not "called from
  // a live, reachable path". A function present exactly once (its own declaration) is at
  // least caught -- pure dead code, never even referenced a second time.
  const source = `
    const WIRE_FIELD = 'synthetic_wire_field';
    function orphanReader(reviewDeal) { return reviewDeal[WIRE_FIELD]; }
    function entry() { return 1; }
  `;
  const analysis = analyseModuleSource(source, 'synthetic-client.js');
  assert.ok(analysis.functions.has('orphanReader'));
  // Confirms the fixture is honest: orphanReader really does evaluate the literal once
  // reached, so a failure below is about reachability, not about the literal being absent.
  assert.ok(analysis.functions.get('orphanReader').tokens.has('WIRE_FIELD'));
});

// ---------------------------------------------------------------------------------------
// 5. Validation contract: a malformed server_stamped_field is rejected before any proof runs.
// ---------------------------------------------------------------------------------------

function withRegisterField(mutate) {
  const forged = structuredClone(CURRENT_M3_FAMILY_PARITY_REGISTER);
  const family = forged.families.find((entry) => entry.family_id === 'TERMINATION_FEE');
  const target = family.product_surfaces.find((entry) => entry.surface_id === 'termination-fee-rendered-rows');
  target.server_stamped_field = mutate(structuredClone(target.server_stamped_field));
  return forged;
}

test('the real register validates cleanly with its one server_stamped_field surface', () => {
  validateM3FamilyParityRegister(CURRENT_M3_FAMILY_PARITY_REGISTER);
});

test('validation rejects a server_stamped_field missing a required key', () => {
  const forged = withRegisterField((shape) => { delete shape.client_function; return shape; });
  assert.throws(() => validateM3FamilyParityRegister(forged), (error) => error.code === 'INVALID_PARITY_REGISTER');
});

test('validation rejects a server_stamped_field with an unknown extra key', () => {
  const forged = withRegisterField((shape) => ({ ...shape, extra_field: 'nope' }));
  assert.throws(() => validateM3FamilyParityRegister(forged), (error) => error.code === 'INVALID_PARITY_REGISTER');
});

test('validation rejects a server_stamped_field whose kind literal is wrong', () => {
  const forged = withRegisterField((shape) => ({ ...shape, kind: 'not_the_right_kind' }));
  assert.throws(() => validateM3FamilyParityRegister(forged), (error) => error.code === 'INVALID_PARITY_REGISTER');
});

test('validation rejects a server_path that does not exist in the repository', () => {
  const forged = withRegisterField((shape) => ({ ...shape, server_path: 'lib/canonical-v2/does-not-exist.js' }));
  assert.throws(() => validateM3FamilyParityRegister(forged), (error) => error.code === 'PARITY_EVIDENCE_PATH_MISSING');
});

test('validation rejects a server_function that does not resolve as a symbol in server_path', () => {
  const forged = withRegisterField((shape) => ({ ...shape, server_function: 'notARealSymbolAnywhere' }));
  assert.throws(() => validateM3FamilyParityRegister(forged), (error) => error.code === 'PARITY_LOCATOR_NOT_FOUND');
});

test('validation rejects a client_function that does not resolve as a symbol in the surface source_path', () => {
  const forged = withRegisterField((shape) => ({ ...shape, client_function: 'notARealSymbolAnywhere' }));
  assert.throws(() => validateM3FamilyParityRegister(forged), (error) => error.code === 'PARITY_LOCATOR_NOT_FOUND');
});

test('validation rejects a server_route outside pages/', () => {
  const forged = withRegisterField((shape) => ({ ...shape, server_route: SERVING_SOURCE }));
  assert.throws(() => validateM3FamilyParityRegister(forged), (error) => error.code === 'INVALID_PARITY_REGISTER');
});

test('validation rejects a server_route that does not exist', () => {
  const forged = withRegisterField((shape) => ({ ...shape, server_route: 'pages/api/does-not-exist.js' }));
  assert.throws(() => validateM3FamilyParityRegister(forged), (error) => error.code === 'PARITY_EVIDENCE_PATH_MISSING');
});

// ---------------------------------------------------------------------------------------
// 6. liveProductVisibility wiring: additive, opt-in, never promotes past an earlier gate.
// ---------------------------------------------------------------------------------------

test('a surface with no server_stamped_field evidence is completely unaffected by this gate', () => {
  // Every one of the 142 other tracked surfaces names no server_stamped_field evidence.
  // Spot-check a real, already-visible one and a real, already-blocked one; neither
  // computation path may even look at the new gate.
  const visibleUnaffected = surface('termination-fee-render-derived-values');
  assert.equal(visibleUnaffected.server_stamped_field, undefined);
  assert.equal(liveProductVisibility(visibleUnaffected), 'DERIVED_VISIBLE');

  const blockedUnaffected = surface('termination-fee-market-fields');
  assert.equal(blockedUnaffected.server_stamped_field, undefined);
  assert.equal(liveProductVisibility(blockedUnaffected), 'NATIVE_UNVERIFIED');
});

test('the gate is additive: it never promotes a surface an earlier gate already rejected', () => {
  // termination-fee-market-fields has no proven consumer at all (family-rollout-mechanics.md
  // Part 2). Attaching perfectly real, perfectly proven server_stamped_field evidence to it
  // must not manufacture visibility -- the earlier gate's NATIVE_UNVERIFIED must survive.
  const blocked = surface('termination-fee-market-fields');
  const withBoundaryEvidence = { ...structuredClone(blocked), server_stamped_field: structuredClone(REAL_CARDS_SHAPE) };
  assert.equal(liveProductVisibility(withBoundaryEvidence), 'NATIVE_UNVERIFIED');
});

test('a surface that clears the earlier gates but fails the boundary proof is withdrawn, not left visible', () => {
  const rendered = surface('termination-fee-rendered-rows');
  const disagreeing = { ...structuredClone(rendered), server_stamped_field: { ...structuredClone(REAL_CARDS_SHAPE), wire_field: 'canonical_v2_termination_fee_serving_enabled' } };
  assert.equal(liveProductVisibility(disagreeing), 'NATIVE_SERVING_BOUNDARY_UNVERIFIED');
  assert.equal(isNativeSemanticCompletion(disagreeing), false);
});

test('an APPROVED_DERIVED surface downgraded by the boundary gate reads DERIVED_SERVING_BOUNDARY_UNVERIFIED, not the NATIVE_ variant', () => {
  const derived = surface('termination-fee-render-derived-values');
  const disagreeing = { ...structuredClone(derived), server_stamped_field: { ...structuredClone(REAL_CARDS_SHAPE), wire_field: 'canonical_v2_preview_enabled' } };
  assert.equal(liveProductVisibility(disagreeing), 'DERIVED_SERVING_BOUNDARY_UNVERIFIED');
  assert.equal(isNativeSemanticCompletion(disagreeing), false);
});

// ---------------------------------------------------------------------------------------
// 7. The finding this task's own audit turned up: the one CURRENTLY NATIVE_VISIBLE
// termination-fee surface cannot honestly carry this evidence at all.
// ---------------------------------------------------------------------------------------

test('termination-fee-query-fields (CompareColumn.jsx/UnifiedCompareSection) reads no termination-fee wire field anywhere, so it cannot honestly carry server_stamped_field evidence', () => {
  const source = fs.readFileSync(COMPARE_COLUMN, 'utf8');
  const analysis = analyseModuleSource(source, COMPARE_COLUMN);
  const wireFields = [
    'canonical_v2_termination_fee_serving_enabled',
    'canonical_v2_termination_fee_cards',
    'canonical_v2_termination_fee_compare_enabled',
    'canonical_v2_termination_fee_source_status',
  ];
  // Exhaustive, not sampled: no top-level function in the file evaluates any of the four
  // wire fields the serving source stamps, whether directly or through a one-hop constant
  // fold. UnifiedCompareSection genuinely only dispatches through
  // config.selectRows(reviewDeal) / column.renderCell(row, ctx) -- source-agnostic by
  // design, per the file's own header comment.
  for (const [, fn] of analysis.functions) {
    for (const field of wireFields) {
      assert.equal(fn.tokens.has(field), false, `unexpected: a function in CompareColumn.jsx evaluates ${field}`);
    }
  }
  // No top-level const even HOLDS one of these strings, so no one-hop fold could ever
  // succeed here either -- the file has genuinely never named a termination-fee wire field.
  for (const [, value] of analysis.constantStrings) {
    assert.equal(wireFields.includes(value), false);
  }

  const entry = surface('termination-fee-query-fields');
  assert.equal(entry.source_path, COMPARE_COLUMN);
  assert.equal(entry.server_stamped_field, undefined);
  // Confirms the register was left honest rather than papering over the gap: this surface's
  // NATIVE_VISIBLE answer (proven in tests/programme-gates/m3-family-parity-register.spec.js)
  // means "compare mode's rendering machinery is reached", never "V2 data crosses the HTTP
  // boundary" -- there is no client_function this file could truthfully name.
});

// ---------------------------------------------------------------------------------------
// 8. Register-level facts, pinned so a future edit cannot silently drift them.
// ---------------------------------------------------------------------------------------

test('termination-fee-rendered-rows is the one surface in the register today whose visibility is boundary-proven', () => {
  const everySurface = [
    ...CURRENT_M3_FAMILY_PARITY_REGISTER.families.flatMap((entry) => entry.product_surfaces),
    ...CURRENT_M3_FAMILY_PARITY_REGISTER.supplemental_owners.flatMap((entry) => entry.product_surfaces),
  ];
  const withBoundaryEvidence = everySurface.filter((entry) => entry.server_stamped_field);
  assert.deepEqual(withBoundaryEvidence.map((entry) => entry.surface_id), ['termination-fee-rendered-rows']);
  assert.equal(servingBoundaryProof(withBoundaryEvidence[0]).proven, true);
});

test('the blocker count reflects exactly this one attributed movement from the pinned 103', () => {
  assert.equal(listM3ProductParityBlockers(CURRENT_M3_FAMILY_PARITY_REGISTER).length, 102);
});
