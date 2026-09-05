'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');

const { transform } = require('next/dist/build/swc');

async function loadProposalCardModule() {
  const filename = require.resolve('../components/product/ProposalCard.jsx');
  const transformed = await transform(fs.readFileSync(filename, 'utf8'), {
    filename,
    jsc: {
      parser: { syntax: 'ecmascript', jsx: true },
      transform: { react: { runtime: 'automatic' } },
    },
    module: { type: 'commonjs' },
  });
  const compiled = new Module(filename, module);
  compiled.filename = filename;
  compiled.paths = Module._nodeModulePaths(path.dirname(filename));
  compiled._compile(transformed.code, filename);
  return compiled.exports;
}

test('evidence-card navigation uses a real fallback span without changing the claimed ID', async () => {
  const { evidenceNavigationSource } = await loadProposalCardModule();
  const unknown = {
    quote: 'Claimed provider text.',
    source_span_id: 'provider-invented-id',
    fallback_source_span_id: 'actual-containing-section-id',
    source_context: { reason: 'Unknown source component.' },
  };

  assert.deepEqual(evidenceNavigationSource(unknown), {
    spanId: 'actual-containing-section-id',
    reviewContext: unknown.source_context,
  });
  assert.equal(unknown.source_span_id, 'provider-invented-id');
  assert.deepEqual(evidenceNavigationSource({
    source_span_id: 'known-span-id', source_context: null,
  }), { spanId: 'known-span-id', reviewContext: null });
});
