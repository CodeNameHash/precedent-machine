'use strict';

// Ruling 3 (Ben, 2026-08-05): the strict H1 locator rule.
//
// A surface may only read as visible when a COMPLETE path is demonstrable: served entry
// point -> transitive imports -> proving consumer -> exact adapter import -> intra-module
// call graph -> the exact symbol named by `source_locator`. Reaching the module is not
// reaching the symbol.
//
// A false positive (claiming served when it is not) is the severe failure, so every branch
// this analysis cannot read with confidence must fail closed. A false negative is a real
// defect too, which is why the analysis is a genuine AST call graph rather than a lexical
// guess: a legitimately served row must be able to prove a transitive path.

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  CURRENT_M3_FAMILY_PARITY_REGISTER,
  analyseModuleSource,
  executedAdapterExportNames,
  isNativeSemanticCompletion,
  listM3ProductParityBlockers,
  liveProductVisibility,
  locatorServingProof,
  moduleImportSpecifiers,
  servedModuleClosure,
  servedModules,
  servingPathReachesLocator,
  unparseableServedCandidates,
} = require('../lib/canonical-v2/native-producer/m3-family-parity-register');

const SEC_MEETING_CONFIG = 'components/review/table-configs/sec-meeting.config.js';
const TERMINATION_FEES_CONFIG = 'components/review/table-configs/termination-fees.config.js';

function surface(id) {
  return [
    ...CURRENT_M3_FAMILY_PARITY_REGISTER.families.flatMap((entry) => entry.product_surfaces),
    ...CURRENT_M3_FAMILY_PARITY_REGISTER.supplemental_owners.flatMap((entry) => entry.product_surfaces),
  ].find((entry) => entry.surface_id === id);
}

function forge(id, overrides) {
  return { ...structuredClone(surface(id)), ...overrides };
}

function prove(source, locator, entrySymbols = []) {
  return locatorServingProof({
    source,
    filePath: 'synthetic-adapter.js',
    entrySymbols,
    locator,
  });
}

// ---------------------------------------------------------------------------------------
// 1. The motivating real case: a genuinely served row proves a transitive path.
// ---------------------------------------------------------------------------------------

test('a served row proves a locator its consumer never imports, reached transitively', () => {
  const deadlines = surface('proxy-render-derived-deadlines');
  assert.equal(deadlines.source_path, 'lib/sec-meeting.js');
  assert.equal(deadlines.source_locator, 'parseDeadlineText');

  // The load-bearing fact: the consumer imports deriveSecMeetingSummary, NOT the locator.
  // A strict rule that demanded the locator itself be imported would wrongly demote this.
  const executed = executedAdapterExportNames(SEC_MEETING_CONFIG, 'lib/sec-meeting.js');
  assert.ok(executed.has('deriveSecMeetingSummary'));
  assert.equal(executed.has('parseDeadlineText'), false);

  // deriveSecMeetingSummary -> normaliseDeadline -> parseDeadlineText, all intra-module.
  const proof = servingPathReachesLocator(deadlines, [SEC_MEETING_CONFIG]);
  assert.equal(proof.proven, true);
  assert.equal(proof.rule, 'FUNCTION_CALL_PATH');

  assert.equal(liveProductVisibility(deadlines), 'DERIVED_VISIBLE');
  assert.equal(isNativeSemanticCompletion(deadlines), true);
});

test('the call graph follows an arbitrarily deep intra-module chain', () => {
  const source = `
    export function entry(rows) { return middle(rows); }
    function middle(rows) { return deeper(rows); }
    function deeper(rows) { return target(rows); }
    function target(rows) { return rows.length; }
    function unrelated() { return 1; }
  `;
  assert.equal(prove(source, 'target', ['entry']).rule, 'FUNCTION_CALL_PATH');
  assert.equal(prove(source, 'deeper', ['entry']).proven, true);
  assert.equal(prove(source, 'unrelated', ['entry']).proven, false);
});

test('a higher-order reference counts as a call edge, because it really does execute', () => {
  const source = `
    export function entry(rows) { return rows.map(target); }
    function target(row) { return row.id; }
  `;
  assert.equal(prove(source, 'target', ['entry']).proven, true);
});

// ---------------------------------------------------------------------------------------
// 2. Dead code inside the adapter must not prove.
// ---------------------------------------------------------------------------------------

test('a locator that is dead code relative to the served path does not prove', () => {
  // secMeetingDisplayState is a genuine export of lib/sec-meeting.js that the served
  // consumer never imports and no reachable function calls. It resolves lexically -- the
  // old module-granular rule would have called this row visible.
  const forged = forge('proxy-render-derived-deadlines', {
    source_locator: 'secMeetingDisplayState',
  });
  const proof = servingPathReachesLocator(forged, [SEC_MEETING_CONFIG]);
  assert.equal(proof.proven, false);
  assert.equal(proof.reason, 'LOCATOR_BINDING_UNREACHABLE');

  assert.equal(liveProductVisibility(forged), 'NATIVE_UNVERIFIED');
  assert.equal(isNativeSemanticCompletion(forged), false);
});

test('an unreferenced helper never becomes reachable just by existing', () => {
  const source = `
    export function entry() { return used(); }
    function used() { return 1; }
    function orphan() { return used(); }
  `;
  const proof = prove(source, 'orphan', ['entry']);
  assert.equal(proof.proven, false);
  assert.equal(proof.rule, 'UNPROVEN');
  assert.equal(proof.reason, 'LOCATOR_BINDING_UNREACHABLE');
});

test('an export manifest names symbols without executing them', () => {
  // This is the rule that stops the whole analysis being hollow. If `export { ... }` or
  // `module.exports = { ... }` seeded reachability, every symbol in every module would be
  // reachable and the gate would prove nothing.
  const esm = `
    function entry() { return 1; }
    function orphan() { return 2; }
    export { entry, orphan };
  `;
  assert.equal(prove(esm, 'orphan', ['entry']).proven, false);

  const cjs = `
    function entry() { return 1; }
    function orphan() { return 2; }
    module.exports = { entry, orphan };
  `;
  assert.equal(prove(cjs, 'orphan', ['entry']).proven, false);

  const frozen = `
    function entry() { return 1; }
    function orphan() { return 2; }
    module.exports = Object.freeze({ entry, orphan });
  `;
  assert.equal(prove(frozen, 'orphan', ['entry']).proven, false);
});

// ---------------------------------------------------------------------------------------
// 3. Ambiguity fails closed.
// ---------------------------------------------------------------------------------------

test('a module the parser cannot read proves nothing', () => {
  const proof = prove('function entry( { ) syntactically broken <<<', 'entry', ['entry']);
  assert.equal(proof.proven, false);
  assert.equal(proof.rule, 'UNPROVEN');
  assert.equal(proof.reason, 'MODULE_NOT_PARSEABLE');
});

test('a duplicated module-level binding is ambiguous and fails closed', () => {
  const source = `
    export function entry() { return target(); }
    var target = function () { return 1; };
    var target = function () { return 2; };
  `;
  const proof = prove(source, 'target', ['entry']);
  assert.equal(proof.proven, false);
  assert.equal(proof.reason, 'LOCATOR_BINDING_AMBIGUOUS');
});

test('an unresolvable re-export contributes no entry symbol', () => {
  // `export { thing } from './elsewhere'` binds nothing locally, so it cannot seed a path.
  const analysis = analyseModuleSource(
    "export { thing } from './elsewhere.js';\nfunction target() { return 1; }\n",
    'synthetic-adapter.js',
  );
  assert.equal(analysis.exportLocals.get('thing'), null);
  assert.equal(prove(
    "export { thing } from './elsewhere.js';\nfunction target() { return 1; }\n",
    'target',
    [],
  ).proven, false);
});

test('a locator reachable only through a shadowing local binding fails closed', () => {
  // The inner `target` is a parameter, not the module function. No real call edge exists.
  const source = `
    export function entry(target) { return target(); }
    function target() { return 1; }
  `;
  assert.equal(prove(source, 'target', ['entry']).proven, false);
});

test('a locator that appears only in a comment or inside unrelated prose proves nothing', () => {
  const commentOnly = `
    // parseDeadlineText is described here and nowhere else
    export function entry() { return 1; }
  `;
  assert.equal(prove(commentOnly, 'parseDeadlineText', ['entry']).proven, false);

  // A symbol that is merely a SUBSTRING of a runtime string is not that symbol. This is
  // the failure mode the old lexical `\\bsymbol\\b` test could not tell apart.
  const prose = `
    export function entry() { return 'documented in parseDeadlineText'.length; }
  `;
  assert.equal(prove(prose, 'parseDeadlineText', ['entry']).proven, false);

  // An exact string key evaluated on a reachable path is the one string form that counts.
  const exactKey = `
    export function entry(features) { return features['fee_percentage']; }
  `;
  assert.equal(prove(exactKey, 'fee_percentage', ['entry']).rule, 'NON_FUNCTION_EVALUATION_SITE');
});

// ---------------------------------------------------------------------------------------
// 4. Non-function locators: the documented rule.
//
// The strict call rule cannot apply to a feature key. The rule chosen is
// NON_FUNCTION_EVALUATION_SITE: the key must be EVALUATED on a reachable path -- it must
// appear inside the body of a function the call graph proves reachable. Being defined in a
// top-level literal is not being served, so a top-level-only key fails closed.
// ---------------------------------------------------------------------------------------

test('a feature key read inside a reachable function proves by the evaluation-site rule', () => {
  const fees = surface('termination-fee-render-derived-values');
  assert.equal(fees.source_path, 'lib/termf.js');
  assert.equal(fees.source_locator, 'percentage_of_equity');

  // percentage_of_equity is a property name, not an export -- there is no call edge to it.
  const executed = executedAdapterExportNames(TERMINATION_FEES_CONFIG, 'lib/termf.js');
  assert.equal(executed.has('percentage_of_equity'), false);
  assert.ok(executed.has('buildTerminationFees'));

  const proof = servingPathReachesLocator(fees, [TERMINATION_FEES_CONFIG]);
  assert.equal(proof.proven, true);
  assert.equal(proof.rule, 'NON_FUNCTION_EVALUATION_SITE');
  // The reason names the reachable function that actually reads the key.
  assert.equal(proof.reason, 'buildTerminationFees');
  assert.equal(liveProductVisibility(fees), 'DERIVED_VISIBLE');
});

test('a feature key defined only in a top-level literal does not prove', () => {
  // lib/query/derived-fields.js declares feePctOfDealValue as a key of the module-level
  // DERIVED_FIELDS literal and nowhere else. Defining a key is not serving its value.
  const queryDerived = surface('termination-fee-query-derived-values');
  assert.equal(queryDerived.source_locator, 'feePctOfDealValue');
  const proof = servingPathReachesLocator(queryDerived, ['lib/query/natural-language.js']);
  assert.equal(proof.proven, false);
  assert.equal(proof.reason, 'LOCATOR_NOT_EVALUATED_ON_A_REACHABLE_PATH');

  // The row is a blocker either way: its consumer sits behind the 503 containment route,
  // so the earlier, more specific serving answer is preserved.
  assert.equal(liveProductVisibility(queryDerived), 'DERIVED_INTEGRATED_NOT_SERVED');
  assert.ok(listM3ProductParityBlockers(CURRENT_M3_FAMILY_PARITY_REGISTER)
    .some((entry) => entry.surface_id === 'termination-fee-query-derived-values'));
});

test('the non-function rule is bounded by reachability, not by presence', () => {
  const source = `
    export function entry(row) { return row.served_key; }
    function orphan(row) { return row.dead_key; }
    const REGISTRY = { literal_key: 1 };
  `;
  assert.equal(prove(source, 'served_key', ['entry']).rule, 'NON_FUNCTION_EVALUATION_SITE');
  // Present in the file, but only inside an unreachable function.
  assert.equal(prove(source, 'dead_key', ['entry']).proven, false);
  // Present in the file, but only as a top-level literal key.
  assert.equal(prove(source, 'literal_key', ['entry']).proven, false);
  // Absent entirely.
  assert.equal(prove(source, 'absent_key', ['entry']).proven, false);
});

test('a module-level value binding proves by reachability, not by the call rule', () => {
  // A rendered config object is a binding, not a function and not a bare key.
  const source = `
    const config = { rows: [] };
    export function entry() { return config; }
  `;
  assert.equal(prove(source, 'config', ['entry']).rule, 'MODULE_BINDING_PATH');

  const unreachable = `
    const config = { rows: [] };
    function orphan() { return config; }
    export function entry() { return 1; }
  `;
  assert.equal(prove(unreachable, 'config', ['entry']).proven, false);
});

// ---------------------------------------------------------------------------------------
// 5. Every pre-existing guard survives, and the gate only ever withdraws a claim.
// ---------------------------------------------------------------------------------------

test('the locator gate runs last and never promotes an unserved or unproven row', () => {
  const everySurface = [
    ...CURRENT_M3_FAMILY_PARITY_REGISTER.families.flatMap((entry) => entry.product_surfaces),
    ...CURRENT_M3_FAMILY_PARITY_REGISTER.supplemental_owners.flatMap((entry) => entry.product_surfaces),
  ];
  // The gate is additive: the only rows it can answer on are rows that had already cleared
  // the consumer proof and the served-entry-point walk, and every one of them proves.
  // termination-fee-query-fields joined this list on 2026-08-05
  // (docs/codex-program/notes/compare-locator-fix.md): its dead CompareSectionColumn locator
  // was repointed to UnifiedCompareSection, the component pages/review/[id].js (its newly
  // named real consumer) actually renders, and the FUNCTION_CALL_PATH rule proves it -- the
  // first NATIVE_COMPLETE (as opposed to APPROVED_DERIVED) surface to clear this exact gate.
  // termination-fee-rendered-rows joined on 2026-08-06
  // (docs/codex-program/notes/serving-path-proof.md): its real, already-served consumer
  // (components/review-v2/sectionList.js) was named in evidence_paths -- the exact naming-gap
  // fix family-rollout-mechanics.md Part 2 had already simulated and left undone -- AND it now
  // carries server_stamped_field evidence that independently, mechanically proves the HTTP-
  // boundary crossing: attachCanonicalTerminationFeeServing (reached from the live,
  // uncontained pages/api/review/[id]/cards.js route) genuinely stamps
  // canonical_v2_termination_fee_cards, and partitionTerminationFeeCards (reached from this
  // same surface's own source_path) genuinely reads that exact field. This is the one surface
  // in the whole register today whose NATIVE_VISIBLE answer means more than "rendering
  // plumbing is reached" -- see servingBoundaryProof and
  // tests/canonical-v2-parity-serving-boundary.test.js.
  const visible = everySurface
    .filter((entry) => ['DERIVED_VISIBLE', 'NATIVE_VISIBLE'].includes(liveProductVisibility(entry)))
    .map((entry) => entry.surface_id)
    .sort();
  assert.deepEqual(visible, [
    'proxy-render-derived-deadlines',
    'termination-fee-query-fields',
    'termination-fee-render-derived-values',
    'termination-fee-rendered-rows',
  ]);

  // Containment and design-guard answers are still reached before the locator rule.
  assert.equal(liveProductVisibility(surface('termination-fee-query-derived-values')), 'DERIVED_INTEGRATED_NOT_SERVED');
  assert.equal(liveProductVisibility({
    surface_id: 'design-entry-probe',
    source_kind: 'RENDERED_ROW',
    source_path: 'pages/design/canonical-v2.js',
    source_locator: 'contentId',
    state: 'PASS',
    disposition: 'NATIVE_COMPLETE',
    wave: 'FOLLOW_ON',
    evidence_paths: ['pages/design/canonical-v2.js', 'lib/canonical-v2/query-result.js'],
  }), 'NATIVE_INTEGRATED_NOT_SERVED');
});

test('a JSON source_path keeps its RFC 6901 pointer rule, which the call rule cannot replace', () => {
  const registry = surface('tax-query-registry');
  assert.equal(registry.source_path, 'lib/query/serving-registry-v1.json');
  const proof = servingPathReachesLocator(registry, []);
  assert.equal(proof.rule, 'JSON_POINTER_LOCATOR');
  // Retired rows are still answered before any serving question is asked.
  assert.equal(liveProductVisibility(registry), 'RETIRED_NOT_RENDERED');
});

test('JSX product files are parsed rather than skipped', () => {
  const analysis = analyseModuleSource(
    'export function Row({ id }) { return <td className="x">{label(id)}</td>; }\n'
      + 'function label(id) { return String(id); }\n',
    'synthetic-component.jsx',
  );
  assert.ok(analysis, 'JSX must lower and parse, otherwise every component fails closed');
  assert.equal(prove(
    'export function Row({ id }) { return <td>{label(id)}</td>; }\nfunction label(id) { return String(id); }\n',
    'label',
    ['Row'],
  ).proven, true);
});

test('the register-wide blocker inventory reflects only real, attributed movement', () => {
  // 104 blockers and 6 review holds were the pinned counts before ruling 3. The strict
  // rule demoted nothing, because every currently-visible row proves a complete path.
  // Back to 104 as of 2026-08-05, after two movements the same day that happen to cancel.
  // Up one: CAPITALISATION was added to the register (previously untracked despite carrying
  // real recorded model output) with one honest, unproven FOLLOW_ON_REQUIRED product
  // surface. Down one: merger-structure-product-projection.js was deleted as dead code, its
  // claim keys and concepts having never existed in the contract bundle, and the
  // structure-market-fields surface went with it because that module was its source_path.
  // The other four structure surfaces stayed blockers; only their false PASS labels changed.
  // Down one more, same day (docs/codex-program/notes/compare-locator-fix.md):
  // termination-fee-query-fields' locator, CompareSectionColumn, was dead code (superseded
  // by UnifiedCompareSection, never called again). Repointed to UnifiedCompareSection with
  // pages/review/[id].js named as its real consumer -- the same naming-gap shape already
  // accepted for its rendered-rows/market-fields siblings -- it clears to NATIVE_VISIBLE.
  // 104 - 1 = 103. The other 13 surfaces sharing that same dead locator were investigated
  // and left blocked: 12 fail earlier, at provingProductConsumers, because CompareColumn.jsx
  // itself never imports the lib/canonical-v2/*-product-projection.js file each names as its
  // adapter, so no locator value could clear them; termination-rights-query-fields would
  // mechanically clear the same way termination-fee-query-fields did but was left blocked on
  // purpose because it would be hollow (see the hostile test in
  // tests/programme-gates/m3-family-parity-register.spec.js). Do not read 103 as evidence of
  // more than this one attributed movement.
  //
  // Down one more, 2026-08-06 (docs/codex-program/notes/serving-path-proof.md):
  // termination-fee-rendered-rows. Two independently-justified changes to the same surface,
  // not one: (a) components/review-v2/sectionList.js, its real, already-served consumer, was
  // named in evidence_paths -- the exact fix family-rollout-mechanics.md Part 2 simulated and
  // left undone, confirmed again here to move the surface to NATIVE_VISIBLE under the
  // PRE-EXISTING mechanism alone; (b) it now ALSO carries server_stamped_field evidence,
  // proving the HTTP-boundary crossing the prior notes named and declined to build --
  // attachCanonicalTerminationFeeServing, reached from the live pages/api/review/[id]/cards.js
  // route, genuinely stamps canonical_v2_termination_fee_cards, and
  // partitionTerminationFeeCards, reached within this surface's own source_path, genuinely
  // reads that exact field. Both had to hold for this surface to clear; either alone would
  // have left it blocked (see tests/canonical-v2-parity-serving-boundary.test.js for both
  // proven independently, and for the hostile case where they disagree). 103 - 1 = 102.
  assert.equal(listM3ProductParityBlockers(CURRENT_M3_FAMILY_PARITY_REGISTER).length, 102);
});

// ---------------------------------------------------------------------------------------
// 6. The served-entry-point walk is a real parse, not a text scan.
//
// servedModules() is the FIRST link of the chain every visibility claim hangs off, and it
// is the link that inflates: a module that joins the served set can only ever push a
// surface towards visible (liveProductVisibility requires every proving consumer to be a
// member, and servedExportUsage mines members for locator entry symbols). A text scan
// cannot tell a real import from a string that merely reads like one, and every phantom
// edge widens the set in exactly the direction that manufactures a false PASS.
// ---------------------------------------------------------------------------------------

function closure(sources, entryPoints) {
  return servedModuleClosure({
    files: new Set(Object.keys(sources)),
    entryPoints,
    readSource: (file) => (Object.hasOwn(sources, file) ? sources[file] : null),
  });
}

test('a specifier that appears only in a comment is not an import edge', () => {
  const { reachable, unparseable } = closure({
    'pages/entry.js': "// require('./phantom')\n"
      + "/* import phantom from './phantom'; */\n"
      + "/** @see require('./phantom') */\n"
      + 'module.exports = function Page() { return null; };\n',
    'pages/phantom.js': 'module.exports = 1;\n',
  }, ['pages/entry.js']);
  assert.deepEqual([...reachable].sort(), ['pages/entry.js']);
  assert.deepEqual([...unparseable], []);
});

test('a specifier that appears only in a string literal is not an import edge', () => {
  const { reachable } = closure({
    'pages/entry.js': 'const NOTE = \'kept separate from "./phantom", never joined\';\n'
      + "const PROMPT = `require('./phantom')`;\n"
      + 'module.exports = { NOTE, PROMPT };\n',
    'pages/phantom.js': 'module.exports = 1;\n',
  }, ['pages/entry.js']);
  assert.deepEqual([...reachable].sort(), ['pages/entry.js']);
});

test('the exact shapes the old text scan matched in this repository are not import edges', () => {
  // Both reproduce a real false match the retired MODULE_SPECIFIER regex produced:
  // `from "treasury shares"` inside a phrasebook row's prose (lexical-disagreement-net.js)
  // and `from "acquisitions"` inside an extraction prompt template (parser-v2/extract.js).
  // Neither happened to resolve to a repository file, which is luck, not a guarantee.
  const specifiers = moduleImportSpecifiers(
    "const ROW = ['TREASURY_STOCK', 'treasury stock', 'kept separate from \"treasury shares\", never slash-joined.'];\n"
      + 'const PROMPT = `Subsidiaries restricted from "acquisitions" / "mergers"`;\n'
      + "// require('./commented-out')\n"
      + "const { canonicalJson } = require('./canonical-bytes');\n",
    'lib/synthetic-phrasebook.js',
  );
  assert.deepEqual(specifiers, ['./canonical-bytes']);
});

test('a multi-line require the old text scan could not close is a real import edge', () => {
  // The mirror failure: `require(\n  './x',\n)` never matched MODULE_SPECIFIER because of
  // the trailing comma, so the old walk under-reported real edges too.
  assert.deepEqual(
    moduleImportSpecifiers("const { validate } = require(\n  './contract-input-validator',\n);\n", 'lib/synthetic.js'),
    ['./contract-input-validator'],
  );
});

test('a genuine transitive import chain is followed end to end, in every import form', () => {
  const { reachable, unparseable } = closure({
    'pages/entry.js': "import { first } from '../lib/first';\n"
      + 'export default function Page() { return first(); }\n',
    'lib/first.js': "const { second } = require('./second');\n"
      + 'function first() { return second(); }\n'
      + 'module.exports = { first };\n',
    'lib/second.js': "export { third as second } from './third';\n",
    'lib/third.js': "export async function third() { const m = await import('./fourth'); return m.fourth(); }\n",
    'lib/fourth.js': 'export function fourth() { return 4; }\n',
    'lib/unreached.js': 'export function nope() { return 0; }\n',
  }, ['pages/entry.js']);
  assert.deepEqual([...reachable].sort(), [
    'lib/first.js',
    'lib/fourth.js',
    'lib/second.js',
    'lib/third.js',
    'pages/entry.js',
  ]);
  assert.deepEqual([...unparseable], []);
});

test('contained routes and design-guarded pages stay outside the real served set', () => {
  const served = servedModules();

  // The 503 containment handlers answer ROUTE_CONTAINED, so nothing reached only through
  // them is served -- including the derived-field module the query surfaces name.
  assert.equal(served.has('pages/api/query/run.js'), false);
  assert.equal(served.has('pages/api/canonical-v2/query.js'), false);
  assert.equal(served.has('lib/query/derived-fields.js'), false);

  // A design-guarded page answers notFound in production and lends serving proof to nothing.
  assert.equal(served.has('pages/design/canonical-v2.js'), false);
  assert.deepEqual([...served].filter((file) => file.startsWith('pages/design/')), []);

  // Two more containment shapes outside QUERY_CONTAINED_ROUTE_FILES
  // (docs/codex-program/notes/family-rollout-mechanics.md, Part 1; fixed
  // docs/codex-program/notes/compare-locator-fix.md, 2026-08-05). Neither corrupted any of
  // the 143 tracked surfaces before this fix -- confirmed again here, not just asserted --
  // but both were live, unexcluded entry points a future surface's evidence could have named.
  //
  // pages/api/market-stats.js's whole body is marketStatsContainedHandler, an unconditional
  // 503 responder (lib/market-stats-containment.js).
  assert.equal(served.has('pages/api/market-stats.js'), false);
  // pages/query/whats-market/adhoc.js's entire getServerSideProps is an unconditional
  // server-side redirect to '/'; no request ever renders the component or reaches what it
  // imports.
  assert.equal(served.has('pages/query/whats-market/adhoc.js'), false);
  // Neither exclusion is a phantom edge in disguise: the real market-metrics code stays
  // served through its own genuine, uncontained page.
  assert.equal(served.has('lib/market-metrics/index.js'), true);

  // The walk still reaches a genuine chain: a live page, its table config, and the adapter
  // the config imports. Without this the exclusions above would be trivially satisfied.
  assert.equal(served.has('pages/review/[id].js'), true);
  assert.equal(served.has(SEC_MEETING_CONFIG), true);
  assert.equal(served.has('lib/sec-meeting.js'), true);
});

test('an unparseable or unreadable module is refused rather than served, and the refusal is visible', () => {
  // The deliberate fail-closed direction. The served set is monotone towards visible, so a
  // module whose contents cannot be read cannot be evidence that it serves anyone. It is
  // withheld from the set, contributes no edges, and is RECORDED rather than swallowed.
  const { reachable, unparseable } = closure({
    'pages/entry.js': "require('./broken');\nrequire('./fine');\n",
    'pages/broken.js': "function ( { <<< not javascript\nrequire('./downstream');\n",
    'pages/downstream.js': 'module.exports = 1;\n',
    'pages/fine.js': 'module.exports = 2;\n',
  }, ['pages/entry.js']);
  assert.deepEqual([...reachable].sort(), ['pages/entry.js', 'pages/fine.js']);
  assert.deepEqual([...unparseable], ['pages/broken.js']);
  // The refused module lends nothing onwards either.
  assert.equal(reachable.has('pages/downstream.js'), false);

  // An unparseable entry point seeds nothing at all.
  const entryBroken = closure({
    'pages/entry.js': 'function ( { <<<\n',
    'pages/target.js': 'module.exports = 1;\n',
  }, ['pages/entry.js']);
  assert.deepEqual([...entryBroken.reachable], []);
  assert.deepEqual([...entryBroken.unparseable], ['pages/entry.js']);

  // A module that cannot be read off disk at all gets the same answer as one that cannot
  // be parsed. Previously an unreadable module was added to the served set anyway.
  const unreadable = servedModuleClosure({
    files: new Set(['pages/entry.js', 'pages/unreadable.js']),
    entryPoints: ['pages/entry.js'],
    readSource: (file) => (file === 'pages/entry.js' ? "require('./unreadable');\n" : null),
  });
  assert.deepEqual([...unreadable.reachable], ['pages/entry.js']);
  assert.deepEqual([...unreadable.unparseable], ['pages/unreadable.js']);
});

test('the live walk refuses nothing today, so no serving claim rests on an unread module', () => {
  // Non-empty is a defect to fix, never a result to accept: it would mean the register is
  // silently under-reporting serving for some part of the product.
  assert.deepEqual(unparseableServedCandidates(), []);
});

test('every served module is a real product source file reached from a live page', () => {
  const served = servedModules();
  assert.ok(served.size > 0);
  assert.ok([...served].every((file) => /\.(js|jsx|mjs)$/.test(file)));
  assert.ok([...served].every((file) => file.startsWith('pages/')
    || file.startsWith('lib/')
    || file.startsWith('components/')));
  assert.ok([...served].some((file) => file.startsWith('pages/')));
});

test('the strict analysis stays fast enough for the programme gates', () => {
  const started = Date.now();
  const everySurface = [
    ...CURRENT_M3_FAMILY_PARITY_REGISTER.families.flatMap((entry) => entry.product_surfaces),
    ...CURRENT_M3_FAMILY_PARITY_REGISTER.supplemental_owners.flatMap((entry) => entry.product_surfaces),
  ];
  everySurface.forEach((entry) => liveProductVisibility(entry));
  assert.ok(Date.now() - started < 5000, 'register-wide visibility sweep must stay under 5s');
});
