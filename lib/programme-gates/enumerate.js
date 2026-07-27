class ClosedMembershipError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ClosedMembershipError';
    this.code = code;
  }
}

function requireArray(value, label) {
  if (!Array.isArray(value)) {
    throw new TypeError(`${label} must be an array`);
  }
  return value;
}

function requireMemberIdentity(member, label) {
  if (!member || typeof member !== 'object' || Array.isArray(member)) {
    throw new TypeError(`${label} must be an object`);
  }
  if (typeof member.member_id !== 'string' || member.member_id.length === 0) {
    throw new TypeError(`${label}.member_id must be a non-empty string`);
  }
  if (typeof member.member_type !== 'string' || member.member_type.length === 0) {
    throw new TypeError(`${label}.member_type must be a non-empty string`);
  }
  return member;
}

function compareUtf8(left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}

function compareMembers(left, right) {
  return compareUtf8(left.member_type, right.member_type)
    || compareUtf8(left.member_id, right.member_id);
}

function indexUniqueMembers(members, label) {
  const byId = new Map();
  members.forEach((member, index) => {
    const checked = requireMemberIdentity(member, `${label}[${index}]`);
    if (byId.has(checked.member_id)) {
      throw new ClosedMembershipError(
        'DUPLICATE_MEMBER',
        `${label} contains duplicate member_id ${checked.member_id}`,
      );
    }
    byId.set(checked.member_id, checked);
  });
  return byId;
}

function enumerateClosedMembers({ expectedMembers, members }) {
  const expected = requireArray(expectedMembers, 'expectedMembers');
  const actual = requireArray(members, 'members');
  const expectedById = indexUniqueMembers(expected, 'expectedMembers');
  const actualById = indexUniqueMembers(actual, 'members');

  for (const [memberId, expectedMember] of expectedById) {
    const actualMember = actualById.get(memberId);
    if (!actualMember) {
      throw new ClosedMembershipError(
        'MISSING_MEMBER',
        `members is missing required member_id ${memberId}`,
      );
    }
    if (actualMember.member_type !== expectedMember.member_type) {
      throw new ClosedMembershipError(
        'WRONG_MEMBER_TYPE',
        `member ${memberId} has type ${actualMember.member_type}; expected ${expectedMember.member_type}`,
      );
    }
  }

  for (const memberId of actualById.keys()) {
    if (!expectedById.has(memberId)) {
      throw new ClosedMembershipError(
        'EXTRA_MEMBER',
        `members contains undeclared member_id ${memberId}`,
      );
    }
  }

  return Object.freeze([...actual].sort(compareMembers));
}

module.exports = {
  ClosedMembershipError,
  compareMembers,
  enumerateClosedMembers,
};
