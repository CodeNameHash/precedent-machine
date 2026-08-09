'use strict';
const { freeze, registryFingerprint } = require('./registry-fingerprint');
const materiality = require('./materiality-qualifier-registry');
const closing = require('./closing-condition-kinds-registry');
const general = require('./general-covenant-registry');
const contracts = require('./material-contract-registry');
const interim = require('./interim-operating-registry');
const party = require('./party-capacity-registry');
const SCHEMA_VERSION = 'RESOLUTION_REGISTRY_SUBSTRATE_MANIFEST/V1';
const modules = freeze([
  ['materiality-qualifier', materiality], ['closing-condition-kinds', closing], ['general-covenant', general], ['material-contract', contracts], ['interim-operating', interim], ['party-capacity', party],
].map(([name, registry]) => ({ name, version: registry.VERSION, digest: registry.DIGEST })));
const PRESERVED_V1_COLLISIONS = freeze([
  { path: 'UNDISCLOSED_LIABILITIES_EXCEPTION_CODES.MAT_MAE_AGGREGATE', label: 'Would not reasonably be expected to have an MAE', v1_only: true, no_delete: true },
  { path: 'MATERIALITY_CODES.MAT_MAE_AGGREGATE', label: 'Would not, individually or in aggregate, have MAE', v1_only: true, no_delete: true },
]);
const MANIFEST = freeze({ schema_version: SCHEMA_VERSION, modules, preserved_v1_collisions: PRESERVED_V1_COLLISIONS });
const DIGEST = registryFingerprint(MANIFEST);
module.exports = freeze({ SCHEMA_VERSION, MODULES: modules, PRESERVED_V1_COLLISIONS, MANIFEST, DIGEST });
