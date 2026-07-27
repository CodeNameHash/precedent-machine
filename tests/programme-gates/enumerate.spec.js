const assert = require('node:assert/strict');
const test = require('node:test');

const {
  ClosedMembershipError,
  enumerateClosedMembers,
} = require('../../lib/programme-gates/enumerate');

const EXPECTED = Object.freeze([
  Object.freeze({ member_id: 'route:z', member_type: 'RouteProbe' }),
  Object.freeze({ member_id: 'code:a', member_type: 'CodeObservation' }),
]);

function member(member_id, member_type, payload = {}) {
  return { member_id, member_type, payload };
}

test('closed membership is deterministic and sorted by UTF-8 type then ID', () => {
  const first = enumerateClosedMembers({
    expectedMembers: EXPECTED,
    members: [
      member('route:z', 'RouteProbe', { status: 503 }),
      member('code:a', 'CodeObservation', { enabled: false }),
    ],
  });
  const second = enumerateClosedMembers({
    expectedMembers: [...EXPECTED].reverse(),
    members: [
      member('code:a', 'CodeObservation', { enabled: false }),
      member('route:z', 'RouteProbe', { status: 503 }),
    ],
  });

  assert.deepEqual(first, second);
  assert.deepEqual(
    first.map(({ member_type, member_id }) => [member_type, member_id]),
    [
      ['CodeObservation', 'code:a'],
      ['RouteProbe', 'route:z'],
    ],
  );
  assert.equal(Object.isFrozen(first), true);
});

test('closed membership rejects a missing member', () => {
  assert.throws(
    () => enumerateClosedMembers({
      expectedMembers: EXPECTED,
      members: [member('code:a', 'CodeObservation')],
    }),
    (error) => error instanceof ClosedMembershipError && error.code === 'MISSING_MEMBER',
  );
});

test('closed membership rejects an extra member', () => {
  assert.throws(
    () => enumerateClosedMembers({
      expectedMembers: EXPECTED,
      members: [
        member('code:a', 'CodeObservation'),
        member('route:z', 'RouteProbe'),
        member('other:x', 'OtherObservation'),
      ],
    }),
    (error) => error instanceof ClosedMembershipError && error.code === 'EXTRA_MEMBER',
  );
});

test('closed membership rejects duplicate expected or actual IDs', () => {
  assert.throws(
    () => enumerateClosedMembers({
      expectedMembers: [EXPECTED[0], EXPECTED[0]],
      members: [member('route:z', 'RouteProbe')],
    }),
    (error) => error instanceof ClosedMembershipError && error.code === 'DUPLICATE_MEMBER',
  );

  assert.throws(
    () => enumerateClosedMembers({
      expectedMembers: EXPECTED,
      members: [
        member('code:a', 'CodeObservation'),
        member('code:a', 'CodeObservation'),
      ],
    }),
    (error) => error instanceof ClosedMembershipError && error.code === 'DUPLICATE_MEMBER',
  );
});

test('closed membership rejects a member with the wrong type', () => {
  assert.throws(
    () => enumerateClosedMembers({
      expectedMembers: EXPECTED,
      members: [
        member('code:a', 'RouteProbe'),
        member('route:z', 'RouteProbe'),
      ],
    }),
    (error) => error instanceof ClosedMembershipError && error.code === 'WRONG_MEMBER_TYPE',
  );
});

test('closed membership rejects malformed member identities', () => {
  assert.throws(
    () => enumerateClosedMembers({
      expectedMembers: EXPECTED,
      members: [
        member('code:a', 1),
        member('route:z', 'RouteProbe'),
      ],
    }),
    TypeError,
  );
});

test('closed membership ignores caller order but preserves member payloads', () => {
  const first = enumerateClosedMembers({
    expectedMembers: EXPECTED,
    members: [
      member('route:z', 'RouteProbe', { status: 503 }),
      member('code:a', 'CodeObservation', { enabled: false }),
    ],
  });
  const second = enumerateClosedMembers({
    expectedMembers: EXPECTED,
    members: [
      member('code:a', 'CodeObservation', { enabled: false }),
      member('route:z', 'RouteProbe', { status: 503 }),
    ],
  });

  assert.deepEqual(first, second);
  assert.deepEqual(first[0].payload, { enabled: false });
});
