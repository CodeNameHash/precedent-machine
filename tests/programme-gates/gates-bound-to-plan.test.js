'use strict';

// Step 1A (docs/core/PLAN.md, "Bind every gate to a step, mechanically").
//
// docs/codex-program/programme-gates.yaml declares 25 pre-production gates,
// twenty of which carry no acceptance criteria at all -- just an identifier
// and the word OPEN -- so historically they could be closed by anybody who
// felt finished, with nothing to stop it. This test makes that impossible
// without changing a test (a visible act): it reads the frozen gate file,
// takes every pre-production gate identifier in it, and fails unless that
// identifier appears -- on the same line, so the pairing is unambiguous --
// next to either a step label ("Step 5C", "Steps 7A to 7C", ...) or the word
// "Retired", in docs/core/PLAN.md or docs/core/COMPLETED.md.
//
// Scope: BOTH gate lists in the registry, 32 identifiers in total.
//
//   preproduction_gates       25 ids, dispositioned by PLAN.md section 5
//   phase_12_security_gates    7 ids, dispositioned by PLAN.md Step 7D
//
// The phase 12 ids were originally left out of this test, on the ground that
// section 5 only ever claimed to disposition 25. That was disclosed rather
// than hidden, and it was still too narrow: Step 1A says *every* gate
// identifier, and those seven were bare ids with a state and no acceptance
// criteria -- the exact condition this test exists to destroy. Step 7D was
// written to give them a disposition, so they now bind under the rule below
// with the rule itself unchanged. Do not relax STEP_LABEL_OR_RETIRED_RE to
// admit a bare "Deferred": that reopens the hole from the other side.
//
// Do not edit docs/codex-program/programme-gates.yaml to make this test
// pass or fail: lib/programme-gates/governing-registry.js:422 throws unless
// the file deep-equals the hardcoded CURRENT_V2_REGISTRY_CONTRACT, so any
// edit to the YAML requires an identical edit to that constant in the same
// change. This test reads the frozen file and binds it from outside.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const YAML = require('yaml');

const REGISTRY_PATH = path.resolve(
  __dirname,
  '../../docs/codex-program/programme-gates.yaml',
);
const PLAN_PATH = path.resolve(__dirname, '../../docs/core/PLAN.md');
const COMPLETED_PATH = path.resolve(__dirname, '../../docs/core/COMPLETED.md');

// A gate identifier is "bound" on a given line if that line contains the
// identifier and also either the literal word "Retired" or a step-label
// pattern such as "Step 5C" or "Steps 7A to 7C". Matching is scoped to a
// single line deliberately: PLAN.md section 5's disposition table pairs
// each gate id with its disposition in one markdown table row (one line),
// so requiring both on the same line is exactly as strict as that table,
// no stricter and no looser.
const STEP_LABEL_OR_RETIRED_RE = /\bRetired\b|\bSteps?\s+\d+[A-Z]\b/;

function readLines(filePath) {
  return fs.readFileSync(filePath, 'utf8').split('\n');
}

function isGateIdBoundOnSomeLine(gateId, lines) {
  const idRe = new RegExp(`(?<![A-Za-z0-9_])${gateId}(?![A-Za-z0-9_])`);
  return lines.some((line) => idRe.test(line) && STEP_LABEL_OR_RETIRED_RE.test(line));
}

function idsFrom(gates, label) {
  assert.ok(Array.isArray(gates) && gates.length > 0, `${label} must be a non-empty array`);
  const ids = gates.map((gate) => gate.id);
  ids.forEach((id) => {
    assert.equal(typeof id, 'string', `every gate in ${label} must have a string id, got ${JSON.stringify(id)}`);
  });
  return ids;
}

// Every gate identifier in the registry, from both lists. A new list added to
// the YAML must be added here too -- which is deliberate: a gate list this
// test does not know about is a gate list nobody is bound to.
function loadAllGateIds() {
  const registry = YAML.parse(fs.readFileSync(REGISTRY_PATH, 'utf8')).programme_gate_registry;
  const declaredLists = Object.keys(registry).filter(
    (key) => key === 'preproduction_gates' || key === 'phase_12_security_gates',
  );
  assert.deepEqual(
    declaredLists.sort(),
    ['phase_12_security_gates', 'preproduction_gates'],
    'the registry no longer carries exactly the two gate lists this test binds; add the new list here and disposition it in PLAN.md',
  );

  return [
    ...idsFrom(registry.preproduction_gates, 'preproduction_gates'),
    ...idsFrom(registry.phase_12_security_gates.gates, 'phase_12_security_gates.gates'),
  ];
}

test('programme-gates.yaml declares exactly the 32 gate identifiers the plan dispositions', () => {
  const registry = YAML.parse(fs.readFileSync(REGISTRY_PATH, 'utf8')).programme_gate_registry;
  assert.equal(registry.preproduction_gates.length, 25, 'expected 25 pre-production gates');
  assert.equal(registry.phase_12_security_gates.gates.length, 7, 'expected 7 phase 12 security gates');
  assert.equal(loadAllGateIds().length, 32);
});

test('every gate identifier is bound to a step label or "Retired" in PLAN.md or COMPLETED.md', () => {
  const gateIds = loadAllGateIds();
  const planLines = readLines(PLAN_PATH);
  const completedLines = readLines(COMPLETED_PATH);

  const unbound = gateIds.filter((gateId) => {
    const boundInPlan = isGateIdBoundOnSomeLine(gateId, planLines);
    const boundInCompleted = isGateIdBoundOnSomeLine(gateId, completedLines);
    return !boundInPlan && !boundInCompleted;
  });

  assert.deepEqual(
    unbound,
    [],
    `${unbound.length} gate id(s) appear in docs/codex-program/programme-gates.yaml but are not bound ` +
      `to a step label or "Retired" on the same line in docs/core/PLAN.md or docs/core/COMPLETED.md: ` +
      `${unbound.join(', ')}. Add a disposition row for each, or a "Retired" note, before closing this gate.`,
  );
});
