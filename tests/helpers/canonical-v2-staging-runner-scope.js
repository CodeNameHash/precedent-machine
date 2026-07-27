const BOUNDARIES = [
  [
    '// F20_ROLLBACK_ONLY_STAGING_CERTIFICATION_BEGIN',
    '// F20_ROLLBACK_ONLY_STAGING_CERTIFICATION_END',
  ],
  [
    '// F23_ROLLBACK_ONLY_STAGING_CERTIFICATION_BEGIN',
    '// F23_ROLLBACK_ONLY_STAGING_CERTIFICATION_END',
  ],
];

function withoutF20RollbackOnlyCertification(source) {
  return BOUNDARIES.reduce((remaining, [begin, end]) => {
    const start = remaining.indexOf(begin);
    const finish = remaining.indexOf(end);
    if (start === -1 || finish === -1 || finish <= start) {
      throw new TypeError(
        `${begin.slice(3, 6)} rollback-only source boundary is missing`,
      );
    }
    return `${remaining.slice(0, start)}${
      remaining.slice(finish + end.length)
    }`;
  }, source);
}

module.exports = {
  withoutF20RollbackOnlyCertification,
};
