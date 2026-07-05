const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

let route;
test.before(async () => {
  route = await import(path.join('..', 'lib', 'review-route.js'));
});

test('parses an empty review route query', () => {
  assert.deepEqual(route.parseReviewRouteQuery({}), {
    section: null,
    provisionId: null,
    tab: null,
    mode: null,
    editProvisionId: null,
  });
});

test('parses the direct-link query contract', () => {
  assert.deepEqual(route.parseReviewRouteQuery({
    section: 'IOC-B',
    tab: 'document',
    mode: 'edit',
    edit: 'prov-2',
  }), {
    section: 'IOC-B',
    provisionId: null,
    tab: 'document',
    mode: 'edit',
    editProvisionId: 'prov-2',
  });
});

test('provision wins over section', () => {
  assert.deepEqual(route.parseReviewRouteQuery({
    section: 'IOC-B',
    provision: 'prov-1',
    tab: 'provisions',
  }), {
    section: null,
    provisionId: 'prov-1',
    tab: 'provisions',
    mode: null,
    editProvisionId: null,
  });
});

test('invalid params are ignored gracefully', () => {
  assert.deepEqual(route.parseReviewRouteQuery({
    section: '',
    provision: '   ',
    tab: 'timeline',
    mode: 'delete',
    edit: ['', 'prov-3'],
  }), {
    section: null,
    provisionId: null,
    tab: null,
    mode: null,
    editProvisionId: 'prov-3',
  });
});

test('serializes review route query state', () => {
  assert.deepEqual(route.serializeReviewRouteQuery({
    section: 'IOC-B',
    tab: 'document',
    editProvisionId: 'prov-2',
  }), {
    section: 'IOC-B',
    tab: 'document',
    mode: 'edit',
    edit: 'prov-2',
  });
});

test('serialization gives provision priority over section', () => {
  assert.deepEqual(route.serializeReviewRouteQuery({
    section: 'IOC-B',
    provisionId: 'prov-1',
    tab: 'provisions',
  }), {
    provision: 'prov-1',
    tab: 'provisions',
  });
});

test('serializes multi-section filters as repeated section values', () => {
  assert.deepEqual(route.serializeReviewRouteQuery({
    section: ['IOC-T', '', 'IOC-B'],
  }), {
    section: ['IOC-T', 'IOC-B'],
  });
});
