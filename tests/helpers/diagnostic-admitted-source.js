'use strict';

const { loadSourceForDiagnostic } = require('../../lib/canonical-v2/native-producer/unified-runner-validate');
const { buildIdentityAdmittedSourceContext } = require('./identity-admitted-source');

function diagnosticAdmittedSource({ source, root_dir: rootDir }) {
  const diagnostic = loadSourceForDiagnostic({ source, root_dir: rootDir });
  if (diagnostic.disposition === 'BLOCKED_SOURCE_PIN') return diagnostic;
  const reference = source.admitted_source_reference || {};
  return Object.freeze({
    ...diagnostic,
    context: buildIdentityAdmittedSourceContext(diagnostic.context.canonical_text.text, {
      dealKey: source.governed_deal_key || reference.governed_deal_key,
      dealAdmissionId: source.deal_admission_id || reference.deal_admission_id,
      sourceOrdinal: source.source_ordinal ?? reference.source_ordinal,
    }),
  });
}

module.exports = { diagnosticAdmittedSource };
