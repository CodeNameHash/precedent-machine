#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(process.argv[2] || '.');
const lib = path.join(root, 'lib');
const signatures = {
  'party-capacity': { declaration: 'PARTY_CAPACITY_SOURCE', atoms: ['\\bcompany\\b', '\\btarget\\b', '\\bparent\\b', '\\bpurchaser\\b', '\\bbuyer\\b', '\\bpubco\\b', 'merger\\s*sub', '\\bseller\\b', '\\bpartnership\\b'] },
  'closing-condition-kinds': { declaration: 'CLOSING_CONDITION_ASSERTION_KINDS', atoms: ['BRING_DOWN_TIER', 'NO_MAE_CONDITION', 'MAE_CONTINUING', 'COVENANT_COMPLIANCE', 'REGULATORY_APPROVAL', 'STOCKHOLDER_APPROVAL', 'LEGAL_RESTRAINT', 'GOVERNMENT_PROCEEDING', 'S4_COMPONENT', 'LISTING', 'FUNDS', 'OFFICER_CERTIFICATE', 'FRUSTRATION_CAUSATION', 'FRUSTRATION_BREACH', 'DOLLAR_THRESHOLD', 'BURDENSOME_CONDITION'] },
  'general-covenant': { declaration: 'GENERAL_COVENANT_CODE_PATTERNS', atoms: ['COV-16B', 'COV-ACCESS', 'short-?swing\\s+profit', 'contingent\\s+value\\s+rights'] },
  'material-contract': { declaration: 'MATERIAL_CONTRACT_BUCKET_META', atoms: ['AGGREGATE_PAYMENTS', 'IP_LICENSES_IN', 'NONCOMPETE', 'affiliate\\s+(?:transaction|agreement|contract)'] },
  'interim-operating': { declaration: 'CATEGORY_TESTS', atoms: ['DIVIDENDS_DISTRIBUTIONS', 'ACQUISITIONS_BUSINESS_COMBINATIONS', 'OTHER_ORDINARY_COURSE', '\\bordinary\\s+course\\b'] },
  'materiality-qualifier': { declaration: 'MATERIALITY_TABLE', atoms: ['MAT_ALL_RESPECTS', 'MAT_MAE_QUALIFIED', 'CAPITAL_STRUCTURE', 'KNOWLEDGE_STANDARD_META'] },
  'representation-topic': { declaration: 'TOPIC_RULES', atoms: ['REP_TOPIC_V1_CORPORATE_ORGANISATION', 'REP_TOPIC_V1_TAX', 'REP_TOPIC_V1_FINANCING', 'REP_TOPIC_V1_TRANSACTION_PROCESS'] },
};
function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) return target.includes(`${path.sep}vocab${path.sep}resolution`) ? [] : files(target);
    return /\.(?:js|mjs|cjs)$/.test(entry.name) ? [target] : [];
  });
}
for (const file of files(lib)) {
  const rel = path.relative(lib, file).split(path.sep).join('/');
  const source = fs.readFileSync(file, 'utf8');
  const executable = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
  for (const [concern, { declaration, atoms }] of Object.entries(signatures)) {
    const definesRegistry = new RegExp(`(?:const|let|var)\\s+${declaration}\\s*=`).test(executable);
    if (definesRegistry && atoms.every((atom) => executable.includes(atom))) {
      process.stderr.write(`REGISTRY_INLINE_DUPLICATE:${concern}:${rel}\n`);
      process.exit(1);
    }
  }
}
process.stdout.write('RESOLUTION_REGISTRY_DUPLICATES: PASS\n');
