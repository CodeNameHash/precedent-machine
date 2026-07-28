const MARKET_STATS_CONTRACT = 'route-disabled-code-test-live-response/v1';
const BROAD_ROUTE_CONTRACT = 'broad-route-inventory-and-containment/v1';
const {
  SOURCE_CONTAINMENT_INVENTORY_EXECUTABLE_DIGEST,
  sourceContainmentInventory,
} = require('./containment-source-inventory');

const CONTAINMENT_MEMBER_SCHEMA_SETS = Object.freeze({
  [MARKET_STATS_CONTRACT]: Object.freeze([
    Object.freeze({
      member_type: 'ContainedRouteMethodProbe',
      schema_id: 'ContainedRouteMethodProbe/V1',
    }),
    Object.freeze({
      member_type: 'ProgrammeGateTestExecutionRecord',
      schema_id: 'ProgrammeGateTestExecutionRecord/V1',
    }),
  ]),
  [BROAD_ROUTE_CONTRACT]: Object.freeze([
    Object.freeze({
      member_type: 'BroadRouteActionObservation',
      schema_id: 'BroadRouteActionObservation/V1',
    }),
    Object.freeze({
      member_type: 'ProgrammeGateTestExecutionRecord',
      schema_id: 'ProgrammeGateTestExecutionRecord/V1',
    }),
  ]),
});

function contractForDefinition(definition) {
  const contract = definition && definition.evidence_contract;
  if (!Object.hasOwn(CONTAINMENT_MEMBER_SCHEMA_SETS, contract)) {
    throw new Error(`unsupported containment evidence contract: ${contract}`);
  }
  return contract;
}

function member(memberId, memberType, payload) {
  return Object.freeze({
    member_id: memberId,
    member_type: memberType,
    ...(payload === undefined ? {} : { payload }),
  });
}

function expectedForMarketStats(evidenceObject) {
  return [
    ...evidenceObject.method_probes.map((probe) => (
      member(probe.member_id, 'ContainedRouteMethodProbe')
    )),
    ...evidenceObject.tests.map((record) => (
      member(`test:${record.test_id}`, 'ProgrammeGateTestExecutionRecord')
    )),
  ];
}

function expectedForBroadRoutes(evidenceObject) {
  return [
    ...sourceContainmentInventory().map((sourceAction) => (
      member(sourceAction.member_id, 'BroadRouteActionObservation')
    )),
    ...evidenceObject.tests.map((record) => (
      member(`test:${record.test_id}`, 'ProgrammeGateTestExecutionRecord')
    )),
  ];
}

function enumerateContainmentExpectedMembers({ definition, evidenceObject }) {
  const contract = contractForDefinition(definition);
  if (!evidenceObject || typeof evidenceObject !== 'object' || Array.isArray(evidenceObject)) {
    throw new TypeError('containment evidence object must be an object');
  }
  const expected = contract === MARKET_STATS_CONTRACT
    ? expectedForMarketStats(evidenceObject)
    : expectedForBroadRoutes(evidenceObject);
  return Object.freeze(expected);
}

function containmentMembers({ definition, evidenceObject }) {
  const contract = contractForDefinition(definition);
  const observations = contract === MARKET_STATS_CONTRACT
    ? evidenceObject.method_probes.map((probe) => (
        member(probe.member_id, 'ContainedRouteMethodProbe', probe)
      ))
    : evidenceObject.routes.map((observation) => (
        member(observation.member_id, 'BroadRouteActionObservation', observation)
      ));
  return Object.freeze([
    ...observations,
    ...evidenceObject.tests.map((record) => (
      member(`test:${record.test_id}`, 'ProgrammeGateTestExecutionRecord', record)
    )),
  ]);
}

function memberSchemaSetForContract(evidenceContract) {
  const schemaSet = CONTAINMENT_MEMBER_SCHEMA_SETS[evidenceContract];
  if (!schemaSet) {
    throw new Error(`unsupported containment evidence contract: ${evidenceContract}`);
  }
  return schemaSet;
}

module.exports = {
  BROAD_ROUTE_CONTRACT,
  CONTAINMENT_MEMBER_SCHEMA_SETS,
  MARKET_STATS_CONTRACT,
  SOURCE_CONTAINMENT_INVENTORY_EXECUTABLE_DIGEST,
  containmentMembers,
  enumerateContainmentExpectedMembers,
  memberSchemaSetForContract,
};
