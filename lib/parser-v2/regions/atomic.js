const ATOMIC_RULES = Object.freeze([
  {
    key: 'nosol',
    label: 'No-solicitation covenant',
    pattern: /no[\s-]*(?:solicitation|shop)|unsolicited\s+proposals?|acquisition\s+proposals?|takeover\s+proposals?|alternative\s+(?:transactions?|proposals?)|company\s+(?:adverse|board)\s+recommendation|parent\s+(?:adverse|board)\s+recommendation|superior\s+proposal/i,
  },
  {
    key: 'ioc',
    label: 'Interim operating covenant',
    pattern: /conduct\s+of\s+(?:the\s+)?(?:business|company|target|seller|parent|buyer)|conduct\s+of\s+(?:company|parent)\s+business\s+pending|interim\s+oper|covenants?\s+of\s+(?:the\s+)?(?:company|target|seller|parent|buyer)|forbearance|affirmative\s+obligations/i,
  },
  {
    key: 'equity_awards',
    label: 'Equity award treatment',
    pattern: /(?:treatment\s+of\s+)?(?:company\s+)?equity\s+compensation\s+awards?|(?:treatment\s+of\s+)?(?:company\s+)?equity\s+awards?|(?:treatment\s+of\s+)?(?:company\s+)?(?:stock\s+options?|restricted\s+stock|restricted\s+stock\s+units?|performance\s+(?:stock\s+)?units?|rsus?|psus?)/i,
  },
  {
    key: 'payment_exchange',
    label: 'Payment and exchange mechanics',
    pattern: /payment\s+for\s+securities;?\s*exchange|exchange\s+(?:agent|fund|procedures)|payment\s+fund|paying\s+agent|exchange\s+of\s+certificates|surrender\s+of\s+certificates|withholding/i,
  },
  {
    key: 'termination_fee',
    label: 'Termination fee mechanics',
    pattern: /termination\s+(?:fee|payment)|expense\s+reimbursement|fees?\s*(?:and|[,;])\s*expenses/i,
  },
  {
    key: 'definitions',
    label: 'Definition section',
    pattern: /^(?:certain\s+)?definitions?$/i,
  },
]);

function atomicRuleForSection(section) {
  const titleHaystack = [
    section && section.title,
    section && section.heading,
    section && section.articleTitle,
  ].filter(Boolean).join(' ');
  const textHead = String(section && section.text || '').slice(0, 300);
  const haystack = `${titleHaystack}\n${textHead}`;

  for (const rule of ATOMIC_RULES) {
    if (rule.pattern.test(haystack)) return rule;
  }
  return null;
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
  atomicRuleForSection,
  indexSubClauses,
  withAtomicMetadata,
};
