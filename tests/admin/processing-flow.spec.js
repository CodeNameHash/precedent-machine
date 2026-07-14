const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('/admin/processing-flow page reads the flow doc and gaps JSON, no live metrics pipeline', () => {
  const page = fs.readFileSync('pages/admin/processing-flow.js', 'utf8');
  assert.match(page, /provision-processing-flow\.md/);
  assert.match(page, /processing-flow-gaps\.json/);
  assert.match(page, /STAGE_METRICS_STUB/);
  // Read-only spec: no live metrics pipeline, no Supabase, no write path.
  assert.doesNotMatch(page, /getServiceSupabase/);
  assert.doesNotMatch(page, /\.insert\(|\.update\(|\.upsert\(|\.delete\(/);
});

test('STAGES has one entry per declared stage, each with owning files and taxonomy nodes', () => {
  const { STAGES } = require('../../lib/admin/processing-flow-stages');
  assert.equal(STAGES.length, 8);
  for (const stage of STAGES) {
    assert.ok(stage.id >= 1 && stage.id <= 8);
    assert.ok(stage.name);
    assert.ok(stage.description);
    assert.ok(Array.isArray(stage.files) && stage.files.length > 0);
    for (const file of stage.files) {
      assert.ok(file.path);
      assert.ok(file.type === 'file' || file.type === 'dir');
    }
    assert.ok(stage.taxonomyNodes);
  }
});

test('processing flow markdown declares a metrics row for each STAGES entry', () => {
  const markdown = fs.readFileSync('docs/schema-shape/provision-processing-flow.md', 'utf8');
  const stageRows = [...markdown.matchAll(/^\|\s*(\d+)\s*\|\s*\*\*([^*]+)\*\*/gm)];
  assert.equal(stageRows.length, 8);
  const { STAGES } = require('../../lib/admin/processing-flow-stages');
  const ids = STAGES.map((stage) => stage.id).sort((a, b) => a - b);
  assert.deepEqual(ids, stageRows.map(([, id]) => Number(id)).sort((a, b) => a - b));
});

test('metrics API route exports a stub, static (no DB call), matching STAGES ids', () => {
  const routeSource = fs.readFileSync('pages/api/admin/processing-flow/metrics.js', 'utf8');
  assert.doesNotMatch(routeSource, /getServiceSupabase|supabase/i);
  const { STAGE_METRICS_STUB } = require('../../pages/api/admin/processing-flow/metrics');
  const { STAGES } = require('../../lib/admin/processing-flow-stages');
  for (const stage of STAGES) {
    assert.ok(Object.prototype.hasOwnProperty.call(STAGE_METRICS_STUB, stage.id), `missing stub metrics for stage ${stage.id}`);
  }
});

test('metrics API handler rejects non-GET and labels the response as a stub', () => {
  const { default: handler } = require('../../pages/api/admin/processing-flow/metrics');
  let statusCode;
  let body;
  const res = {
    setHeader() {},
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      body = payload;
      return this;
    },
  };
  handler({ method: 'GET' }, res);
  assert.equal(statusCode, 200);
  assert.equal(body.stub, true);

  handler({ method: 'POST' }, res);
  assert.equal(statusCode, 405);
});

test('gaps JSON reflects current gap status: GAP-A/GAP-B done, GAP-C partial, GAP-E open/proposed', () => {
  const gaps = JSON.parse(fs.readFileSync('docs/schema-shape/processing-flow-gaps.json', 'utf8')).gaps;
  const byId = Object.fromEntries(gaps.map((gap) => [gap.id, gap]));
  assert.equal(byId['GAP-A'].status, 'done');
  assert.equal(byId['GAP-B'].status, 'done');
  assert.equal(byId['GAP-C'].status, 'partial');
  assert.equal(byId['GAP-E'].status, 'open');
  assert.equal(byId['GAP-E'].phase, 'proposed');
  // Only status fields should differ from the original descriptions -- guard
  // that the prose fields haven't drifted while the statuses were updated.
  assert.match(byId['GAP-A'].problem, /reprocess\.js writes Provisions only/);
  assert.match(byId['GAP-B'].problem, /region_hash collision|provision_cards_deal_region_hash_unique/);
  assert.match(byId['GAP-C'].problem, /22 -> 16 -> 15/);
  assert.match(byId['GAP-E'].problem, /silent-drop-to-fallback|silently degrades to prior text/);
});

test('nav registry includes processing-flow page in schema group', () => {
  const registry = require('../../docs/admin/nav-registry.json');
  const entry = registry.find((item) => item.id === 'processing-flow');
  assert.equal(entry.href, '/admin/processing-flow');
  assert.equal(entry.group, 'schema');
  assert.equal(entry.order, 50);
  assert.ok(fs.existsSync('pages/admin/processing-flow.js'));
});
