const { segmentSubClauses } = require('./parser-v2/subclauses');

const TREATMENT_ALIASES = Object.freeze({
  ALL_RESPECTS: 'MAT_ALL_RESPECTS',
  MAT_ALL_RESPECTS: 'MAT_ALL_RESPECTS',
  DE_MINIMIS: 'MAT_ALL_RESPECTS_DE_MINIMIS',
  ALL_RESPECTS_DE_MINIMIS: 'MAT_ALL_RESPECTS_DE_MINIMIS',
  MAT_ALL_RESPECTS_DE_MINIMIS: 'MAT_ALL_RESPECTS_DE_MINIMIS',
  ALL_MATERIAL: 'MAT_ALL_MATERIAL',
  MAT_ALL_MATERIAL: 'MAT_ALL_MATERIAL',
  MAE_QUALIFIED: 'MAT_MAE_QUALIFIED',
  MAT_MAE_QUALIFIED: 'MAT_MAE_QUALIFIED',
  MATERIALITY_SCRAPE: 'MAT_MATERIALITY_SCRAPE',
  MAT_MATERIALITY_SCRAPE: 'MAT_MATERIALITY_SCRAPE',
});

function textOf(value) {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'object') return String(value);
  if (Array.isArray(value)) return value.map(textOf).filter(Boolean).join(' ');
  return Object.entries(value)
    .filter(([key]) => !['treatment_codes', 'treatmentCodes'].includes(key))
    .map(([, item]) => textOf(item))
    .filter(Boolean)
    .join(' ');
}

function codeOf(tier) {
  return String(tier?.standard || tier?.standard_code || tier?.code || '').trim().toUpperCase();
}

function canonicalTreatmentCode(value) {
  const code = String(value || '').trim().toUpperCase();
  return TREATMENT_ALIASES[code] || null;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function bringDownTreatmentCodes(tier) {
  if (!tier || typeof tier !== 'object') return [];
  const declared = [
    codeOf(tier),
    ...(Array.isArray(tier.treatment_codes) ? tier.treatment_codes : []),
    ...(Array.isArray(tier.treatmentCodes) ? tier.treatmentCodes : []),
  ].map(canonicalTreatmentCode).filter(Boolean);
  const text = textOf(tier);
  const operativeText = text.split(/;\s*(?:provided\b|for\s+purposes\b)/i)[0];
  const inferred = [];
  if (/except\s+for\s+(?:any\s+)?de\s+minimis\s+inaccurac|de\s+minimis\s+inaccurac/i.test(operativeText)) {
    inferred.push('MAT_ALL_RESPECTS_DE_MINIMIS');
  }
  if (/failure\s+to\s+be\s+(?:so\s+)?true\s+and\s+correct[\s\S]{0,260}(?:would|could)\s+not[\s\S]{0,180}material\s+adverse\s+effect/i.test(operativeText)) {
    inferred.push('MAT_MAE_QUALIFIED');
  }
  if (/true\s+and\s+correct(?:\s*\([^)]*\))?\s+in\s+all\s+material\s+respects/i.test(operativeText)
    || /true\s+in\s+all\s+material\s+respects/i.test(operativeText)) {
    inferred.push('MAT_ALL_MATERIAL');
  }
  if (/true\s+and\s+correct\s+in\s+all\s+respects/i.test(operativeText)
    && !/in\s+all\s+material\s+respects/i.test(operativeText)) {
    inferred.push('MAT_ALL_RESPECTS');
  }
  if (/disregard(?:ing|ed)?[\s\S]{0,180}(?:qualification|limitation)s?[\s\S]{0,100}(?:material|materiality|material\s+adverse\s+effect)/i.test(operativeText)
    || /without\s+giving\s+effect\s+to[\s\S]{0,160}(?:materiality|material\s+adverse\s+effect)/i.test(operativeText)) {
    inferred.push('MAT_MATERIALITY_SCRAPE');
  }
  return unique([...declared, ...inferred]);
}

function accuracyClause(text) {
  return /representations?\s+and\s+warranties?/i.test(text)
    && /true\s+and\s+correct/i.test(text);
}

function coveredReps(text) {
  const source = String(text || '').trim();
  const accuracyAt = source.search(/\b(?:shall\s+be|are|were|be)\s+true\s+and\s+correct\b/i);
  const prefix = accuracyAt >= 0 ? source.slice(0, accuracyAt).trim() : source;
  const setForth = prefix.match(/representations?\s+and\s+warranties?\s+of\s+(?:the\s+)?(?:Company|Parent|Buyer|Seller|Merger\s+Sub(?:sidiary)?)\s+set\s+forth\s+in\s+([\s\S]+)$/i);
  if (setForth) {
    const covered = setForth[1].replace(/^[,;:\s]+|[,;:\s]+$/g, '').trim();
    if (/^this\s+Agreement\s*\(other\s+than/i.test(covered)) {
      return `All other representations ${covered.replace(/^this\s+Agreement\s*/i, '')}`.trim();
    }
    return covered;
  }
  if (/\bother\s+representations?\s+and\s+warranties?/i.test(prefix)) return 'All other representations';
  const party = /representations?\s+and\s+warranties?\s+of\s+(?:the\s+)?(Parent|Buyer|Seller|Company)/i.exec(prefix)?.[1];
  return party ? `All ${party} representations` : 'All representations';
}

function tierFromClause(clause) {
  const text = String(clause || '').trim();
  if (!accuracyClause(text)) return null;
  const treatmentCodes = bringDownTreatmentCodes({ text });
  const primary = treatmentCodes.find((code) => code !== 'MAT_MATERIALITY_SCRAPE')
    || treatmentCodes[0]
    || null;
  if (!primary) return null;
  return {
    standard: primary,
    reps_covered: coveredReps(text),
    treatment_codes: treatmentCodes,
    materiality_scrape: treatmentCodes.includes('MAT_MATERIALITY_SCRAPE'),
    quotes: [text],
  };
}

function candidateClauses(text) {
  const source = String(text || '').trim();
  if (!source) return [];
  let leaves = [];
  try {
    leaves = segmentSubClauses(source) || [];
  } catch {
    leaves = [];
  }
  const leafClauses = leaves.map((leaf) => leaf?.text).filter((value) => accuracyClause(String(value || '')));
  if (leafClauses.length) return leafClauses;

  const starts = [...source.matchAll(/(?:^|[;.]\s+|\n\s*)\(([A-Z])\)\s*(?=(?:any\s+of\s+)?(?:the\s+)?representations?\s+and\s+warranties?)/g)];
  if (!starts.length) return accuracyClause(source) ? [source] : [];
  return starts.map((match, index) => {
    const start = match.index + match[0].lastIndexOf(')') + 1;
    const end = starts[index + 1]?.index ?? source.length;
    return source.slice(start, end).trim();
  });
}

function mergeRecoveredTiers(tiers) {
  const byKey = new Map();
  for (const tier of tiers) {
    const codes = bringDownTreatmentCodes(tier);
    if (!codes.length) continue;
    const covered = String(tier.reps_covered || tier.repsCovered || '').replace(/\s+/g, ' ').trim();
    const key = `${covered.toLowerCase()}|${codes.join('|')}`;
    if (!byKey.has(key)) byKey.set(key, { ...tier, treatment_codes: codes });
  }
  return [...byKey.values()];
}

function recoverBringDownTiers(text) {
  return mergeRecoveredTiers(candidateClauses(text).map(tierFromClause).filter(Boolean));
}

function normaliseBringDownTiers(existing, sourceText = '') {
  const tiers = Array.isArray(existing) ? existing : (existing && typeof existing === 'object' ? [existing] : []);
  if (!tiers.length) return recoverBringDownTiers(sourceText);
  return mergeRecoveredTiers(tiers.map((tier) => {
    const codes = bringDownTreatmentCodes(tier);
    const primary = codes.find((code) => code !== 'MAT_MATERIALITY_SCRAPE') || codes[0] || codeOf(tier);
    return {
      ...tier,
      ...(primary ? { standard: primary } : {}),
      treatment_codes: codes,
      materiality_scrape: codes.includes('MAT_MATERIALITY_SCRAPE'),
    };
  }));
}

function inferBringDownProvisionCode(text, existingCode = '') {
  if (!recoverBringDownTiers(text).length) return null;
  const code = String(existingCode || '').trim().toUpperCase();
  const band = /^COND-([BS])-/.exec(code)?.[1];
  if (band) return `COND-${band}-REP`;
  const source = String(text || '');
  const parent = /representations?\s+and\s+warranties?\s+of\s+(?:Parent|Buyer|Merger\s+Sub)/i.test(source);
  const company = /representations?\s+and\s+warranties?\s+of\s+(?:the\s+)?(?:Company|Target|Seller)/i.test(source);
  if (company && !parent) return 'COND-B-REP';
  if (parent && !company) return 'COND-S-REP';
  return null;
}

function sourceTextForCard(card) {
  return String(card?.primary_quote || card?.region_full_text || card?.full_text || '').trim();
}

function recoverBringDownFromCard(card) {
  const text = sourceTextForCard(card);
  const existing = card?.features?.bringDownTiers;
  const tiers = normaliseBringDownTiers(existing, text);
  const provisionCode = tiers.length
    ? (inferBringDownProvisionCode(text, card?.provision_subtype || card?.canonical_code || card?.provision_code)
      || (/^COND-[BS]-REP$/i.test(String(card?.provision_subtype || '')) ? String(card.provision_subtype).toUpperCase() : null))
    : null;
  return { tiers, provisionCode, sourceText: text };
}

module.exports = {
  bringDownTreatmentCodes,
  canonicalTreatmentCode,
  inferBringDownProvisionCode,
  normaliseBringDownTiers,
  recoverBringDownFromCard,
  recoverBringDownTiers,
  sourceTextForCard,
};
