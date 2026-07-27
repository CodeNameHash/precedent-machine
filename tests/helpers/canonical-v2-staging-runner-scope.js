const BEGIN =
  '// F20_ROLLBACK_ONLY_STAGING_CERTIFICATION_BEGIN';
const END =
  '// F20_ROLLBACK_ONLY_STAGING_CERTIFICATION_END';

function withoutF20RollbackOnlyCertification(source) {
  const start = source.indexOf(BEGIN);
  const finish = source.indexOf(END);
  if (start === -1 || finish === -1 || finish <= start) {
    throw new TypeError('F20 rollback-only source boundary is missing');
  }
  return `${source.slice(0, start)}${source.slice(finish + END.length)}`;
}

module.exports = {
  withoutF20RollbackOnlyCertification,
};
