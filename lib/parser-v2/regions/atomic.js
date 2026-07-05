const ATOMIC_RULES = Object.freeze([
  {
    key: 'nosol',
    label: 'No-solicitation covenant',
    pattern: /no[\s-]?solicitation/i,
  },
  {
    key: 'ioc',
    label: 'Interim operating covenant',
    pattern: /^conduct of (?:company|parent|the) business pending/i,
  },
  {
    key: 'equity_awards',
    label: 'Equity award treatment',
    pattern: /treatment of (?:company )?equity (?:compensation )?awards?/i,
  },
  {
    key: 'payment_exchange',
    label: 'Payment and exchange mechanics',
    pattern: /payment for securities;?\s*exchange|exchange and payment/i,
  },
  {
    key: 'employee_matters',
    label: 'Employee matters',
    pattern: /(?:employee|employees) matters?/i,
  },
  {
    key: 'definitions',
    label: 'Definition section',
    pattern: /^(?:certain\s+)?definitions?$/i,
  },
]);

function getAtomicRule(sectionHeadingLower, classificationHint) {
  const heading = String(sectionHeadingLower || '').trim();
  const hint = String(classificationHint || '').trim().toUpperCase();
  if (hint === 'NOSOL') return ATOMIC_RULES.find((rule) => rule.key === 'nosol');
  if (hint === 'IOC' || hint === 'IOC-T' || hint === 'IOC-B') return ATOMIC_RULES.find((rule) => rule.key === 'ioc');
  if (hint === 'DEF') return ATOMIC_RULES.find((rule) => rule.key === 'definitions');
  for (const rule of ATOMIC_RULES) {
    if (rule.pattern.test(heading)) return rule;
  }
  return null;
}

function atomicRuleForSection(section) {
  const heading = String(
    (section && (section.title || section.heading)) || ''
  ).toLowerCase();
  const hint = section && (
    section.provisionType ||
    section.type ||
    section.classificationHint ||
    section.regionType
  );
  return getAtomicRule(heading, hint);
}

function indexSubClauses(text) {
  const body = String(text || '');
  const markers = [];
  const markerRe = /(?:^|\n|\s)\(([a-z])\)\s+/g;
  let m;
  while ((m = markerRe.exec(body)) !== null) {
    const start = m.index + m[0].indexOf('(');
    if (start < 0) continue;
    const label = m[1];
    const expected = String.fromCharCode(97 + markers.length);
    if (markers.length > 0 && label !== expected) continue;
    if (markers.length === 0 && label !== 'a') continue;
    markers.push({ label, start });
  }

  return markers.map((marker, index) => {
    const end = index + 1 < markers.length ? markers[index + 1].start : body.length;
    return {
      label: marker.label,
      index,
      start: marker.start,
      end,
      length: end - marker.start,
    };
  });
}

function withAtomicMetadata(section) {
  const rule = atomicRuleForSection(section);
  const subClauses = indexSubClauses(section && section.text);
  if (!rule) {
    return {
      atomic: false,
      atomicReason: null,
      subClauses,
    };
  }
  return {
    atomic: true,
    atomicReason: rule.key,
    atomicLabel: rule.label,
    subClauses,
  };
}

module.exports = {
  ATOMIC_RULES,
  getAtomicRule,
  atomicRuleForSection,
  indexSubClauses,
  withAtomicMetadata,
};
