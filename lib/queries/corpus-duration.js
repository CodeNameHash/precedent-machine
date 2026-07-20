const { parseDuration, wordsToNumber } = require('../normalize-numeric');

const CLOCK_UNIT_RE = /\b(?:business[\s-]+days?|calendar[\s-]+days?|hours?|days?|months?|years?)\b/i;

function claimCode(claim) {
  return String(claim?.provenance?.code || '').trim().toUpperCase();
}

function scalarNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);
  return wordsToNumber(trimmed);
}

function canonicalDurationUnit(unit) {
  const raw = String(unit || '').trim().toLowerCase().replace(/[_-]+/g, ' ');
  if (/^(?:elapsed )?hours?$/.test(raw)) return 'elapsed_hours';
  if (/^business days?$/.test(raw) || raw === 'business') return 'business_days';
  if (/^(?:calendar )?days?$/.test(raw) || raw === 'calendar') return 'calendar_days';
  if (/^months?$/.test(raw)) return 'months';
  if (/^years?$/.test(raw)) return 'years';
  return null;
}

function claimScalarValues(claim) {
  const provenance = claim?.provenance && typeof claim.provenance === 'object' ? claim.provenance : {};
  const featureValue = provenance.feature_value;
  const candidates = [claim?.canonical, claim?.verbatim];
  if (featureValue && typeof featureValue === 'object') candidates.push(featureValue.value);
  else candidates.push(featureValue);
  return candidates.map(scalarNumber).filter((value) => value !== null);
}

function claimScalar(claim) {
  const values = claimScalarValues(claim);
  if (!values.length) return null;
  return new Set(values).size === 1 ? values[0] : null;
}

function structuredDuration(claim) {
  const provenance = claim?.provenance && typeof claim.provenance === 'object' ? claim.provenance : {};
  const featureValue = provenance.feature_value && typeof provenance.feature_value === 'object'
    ? provenance.feature_value
    : null;
  const candidates = [
    { value: provenance.value, unit: provenance.unit || provenance.time_unit || provenance.calendar_basis },
    featureValue ? {
      value: featureValue.value,
      unit: featureValue.unit || featureValue.time_unit || featureValue.calendar_basis,
    } : null,
  ].filter(Boolean)
    .map((candidate) => ({ value: scalarNumber(candidate.value), unit: canonicalDurationUnit(candidate.unit) }))
    .filter((candidate) => candidate.value !== null && candidate.unit);
  if (!candidates.length) return undefined;
  const keys = new Set(candidates.map((candidate) => `${candidate.value}|${candidate.unit}`));
  return keys.size === 1 ? candidates[0] : null;
}

function primaryEvidenceTexts(claim) {
  const provenance = claim?.provenance && typeof claim.provenance === 'object' ? claim.provenance : {};
  const featureValue = provenance.feature_value && typeof provenance.feature_value === 'object'
    ? provenance.feature_value
    : {};
  return [
    claim?.evidence_quote,
    provenance.evidence_quote,
    provenance.quote,
    featureValue.text,
    featureValue.verbatim,
    ...(Array.isArray(featureValue.quotes) ? featureValue.quotes : []),
  ].filter((value) => typeof value === 'string' && value.trim());
}

function durationFromTexts(texts, expectedValue) {
  const candidates = [];
  for (const text of texts) {
    const parsed = parseDuration(text);
    if (!parsed) {
      if (CLOCK_UNIT_RE.test(text)) return null;
      continue;
    }
    candidates.push(parsed);
  }
  if (!candidates.length) return undefined;
  if (expectedValue !== null && candidates.some((candidate) => candidate.value !== expectedValue)) return null;
  const keys = new Set(candidates.map((candidate) => `${candidate.value}|${candidate.unit}`));
  return keys.size === 1 ? candidates[0] : null;
}

function normalizeDurationClaim(claim, linkedEvidence = null) {
  const direct = typeof claim?.verbatim === 'string' ? parseDuration(claim.verbatim) : null;
  if (direct) {
    if (claimScalarValues(claim).some((value) => value !== direct.value)) return null;

    const fromPrimaryEvidence = durationFromTexts(primaryEvidenceTexts(claim), direct.value);
    if (fromPrimaryEvidence === null) return null;

    const structured = structuredDuration(claim);
    if (structured === null) return null;

    let fromLinkedEvidence;
    if (typeof linkedEvidence === 'string' && linkedEvidence.trim()) {
      fromLinkedEvidence = durationFromTexts([linkedEvidence], direct.value);
      if (fromLinkedEvidence === null) return null;
    }

    const corroborating = [fromPrimaryEvidence, structured, fromLinkedEvidence].filter(Boolean);
    if (corroborating.some((candidate) => (
      candidate.value !== direct.value || candidate.unit !== direct.unit
    ))) return null;
    return direct;
  }

  const expectedValue = claimScalar(claim);
  if (expectedValue === null || expectedValue < 0) return null;

  const fromPrimaryEvidence = durationFromTexts(primaryEvidenceTexts(claim), expectedValue);
  if (fromPrimaryEvidence === null) return null;

  const structured = structuredDuration(claim);
  if (structured === null) return null;
  if (structured && structured.value !== expectedValue) return null;
  if (fromPrimaryEvidence && structured && fromPrimaryEvidence.unit !== structured.unit) return null;
  if (fromPrimaryEvidence) return fromPrimaryEvidence;
  if (structured) return structured;

  if (typeof linkedEvidence !== 'string' || !linkedEvidence.trim()) return null;
  const fromLinkedEvidence = durationFromTexts([linkedEvidence], expectedValue);
  return fromLinkedEvidence || null;
}

function linkedEvidenceForClaim(claim, evidenceByCardKey) {
  if (!claim?.excerpt_id || !(evidenceByCardKey instanceof Map)) return null;
  return evidenceByCardKey.get(`${claim.deal_id}|${claim.excerpt_id}`) || null;
}

function collapseSubject(entries, requireSingleCode) {
  if (!entries.length) return null;
  const durationKeys = new Set(entries.map((entry) => `${entry.duration.value}|${entry.duration.unit}`));
  if (durationKeys.size !== 1) return null;
  const codes = new Set(entries.map((entry) => claimCode(entry.claim)).filter(Boolean));
  if (requireSingleCode && codes.size !== 1) return null;
  return { ...entries[0], code: [...codes][0] || null };
}

function selectDurationCohort({ claims, subjectDealId, requestedCode, evidenceByCardKey }) {
  const code = String(requestedCode || '').trim().toUpperCase();
  const source = (claims || []).filter((claim) => claim && claim.deal_id);
  const subjectClaims = source.filter((claim) => claim.deal_id === subjectDealId);
  const exactSubjectClaims = code ? subjectClaims.filter((claim) => claimCode(claim) === code) : [];
  const subjectPool = exactSubjectClaims.length ? exactSubjectClaims : subjectClaims;
  const normalizedSubject = subjectPool
    .map((claim) => ({ claim, duration: normalizeDurationClaim(claim, linkedEvidenceForClaim(claim, evidenceByCardKey)) }))
    .filter((entry) => entry.duration);

  if (!normalizedSubject.length) return { cohort: null, reason: 'subject-duration-unknown' };
  const subject = collapseSubject(normalizedSubject, !exactSubjectClaims.length);
  if (!subject) return { cohort: null, reason: 'subject-duration-ambiguous' };

  const triggerCode = exactSubjectClaims.length ? code : subject.code;
  if (!triggerCode) return { cohort: null, reason: 'subject-trigger-unknown' };

  const triggerClaims = source.filter((claim) => claimCode(claim) === triggerCode);
  const eligibleDealIds = new Set(triggerClaims.map((claim) => claim.deal_id));
  const matchingByDeal = new Map();
  for (const claim of triggerClaims) {
    const duration = normalizeDurationClaim(claim, linkedEvidenceForClaim(claim, evidenceByCardKey));
    if (!duration || duration.unit !== subject.duration.unit) continue;
    if (!matchingByDeal.has(claim.deal_id)) matchingByDeal.set(claim.deal_id, []);
    matchingByDeal.get(claim.deal_id).push({ claim, duration });
  }

  const entries = [];
  for (const dealEntries of matchingByDeal.values()) {
    const keys = new Set(dealEntries.map((entry) => `${entry.duration.value}|${entry.duration.unit}`));
    if (keys.size === 1) entries.push(dealEntries[0]);
  }

  return {
    cohort: {
      entries,
      unit: subject.duration.unit,
      triggerCode,
      subjectValue: subject.duration.value,
      eligibleDealCount: eligibleDealIds.size,
      excludedDealCount: Math.max(0, eligibleDealIds.size - entries.length),
    },
    reason: null,
  };
}

module.exports = {
  claimCode,
  normalizeDurationClaim,
  selectDurationCohort,
};
