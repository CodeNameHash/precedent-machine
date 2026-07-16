const crypto = require('crypto');
const { EQUITY_INSTRUMENTS } = require('../taxonomy');
const { firstAffirmativeMention } = require('../instrument-negation');
const { normalizeText } = require('./region-store');
const { classifyConsiderationGrouping } = require('./detectors/consideration-grouping');
const { buildElectionMechanism, enforceElectionInvariants } = require('./elections');

const EXTRACTION_VERSION = 'consideration-equity-v1';

const INSTRUMENT_ORDER = [
  'STOCK_OPTIONS',
  'RSA',
  'RSU',
  'PSU',
  'ESPP',
  'SAR',
  'PHANTOM_STOCK',
  'DSU',
  'DIRECTOR_EQUITY',
  'OTHER_EQUITY',
];

const INSTRUMENT_RE = {
  STOCK_OPTIONS: /\b(?:Company\s+)?(?:Stock\s+)?Options?\b/i,
  RSA: /\b(?:Company\s+)?(?:Restricted\s+Stock\s+Awards?|RSAs?)\b/i,
  RSU: /\b(?:Company\s+)?(?:Restricted\s+Stock\s+Units?|RSUs?)\b/i,
  PSU: /\b(?:Company\s+)?(?:Performance\s+(?:Stock\s+|Share\s+)?Units?|PSUs?)\b/i,
  ESPP: /\b(?:Company\s+)?(?:ESPP|Employee\s+Stock\s+Purchase\s+Plan)\b/i,
  SAR: /\b(?:Stock\s+Appreciation\s+Rights?|SARs?)\b/i,
  PHANTOM_STOCK: /\bphantom\s+stock\b/i,
};

// Strict mention patterns shared with extract.js's deterministic instrument
// backfill (backfillMissingInstrumentMentions). These are deliberately
// tighter than INSTRUMENT_RE above — bare "option"/"Options" hits contract
// boilerplate ("at the option of Parent"), so a mention only counts when the
// instrument is actually named.
const INSTRUMENT_MENTION_RES = {
  STOCK_OPTIONS: /\b(?:company\s+)?stock\s+options?\b/i,
  // Acronym alternatives stay case-sensitive (RSAs ≠ rsas mid-word); the
  // spelled-out phrases are case-tolerant via bracketed initials.
  RSUs: /\b[Rr]estricted\s+[Ss]tock\s+[Uu]nits?\b|\bRSUs?\b/,
  PSUs: /\b[Pp]erformance\s+(?:[Ss]tock\s+|[Ss]hare\s+)?[Uu]nits?\b|\bPSUs?\b/,
  RESTRICTED_STOCK: /\b[Rr]estricted\s+[Ss]tock\s+[Aa]wards?\b|\bRSAs?\b/,
  WARRANTS: /\bwarrants?\s+to\s+purchase\b|\bcompany\s+warrants?\b/i,
  ESPP: /\b[Ee]mployee\s+[Ss]tock\s+[Pp]urchase\s+[Pp]lan\b|\bESPP\b/,
  SARS: /\b[Ss]tock\s+[Aa]ppreciation\s+[Rr]ights?\b|\bSARs?\b/,
  CONVERTIBLE_NOTES: /\bconvertible\s+notes?\b/i,
  PHANTOM_STOCK: /\bphantom\s+stock\b/i,
};

// True when the text names at least one equity instrument in a non-negated
// sentence — i.e. there was genuinely something for extraction to find.
function hasAffirmativeInstrumentMention(text) {
  const source = String(text || '');
  for (const re of Object.values(INSTRUMENT_MENTION_RES)) {
    if (firstAffirmativeMention(re, source)) return true;
  }
  return false;
}

function mentionedInstrumentTypes(text) {
  const found = new Set();
  const source = String(text || '');
  for (const [code, re] of Object.entries(INSTRUMENT_RE)) {
    if (re.test(source)) found.add(code);
  }
  return found;
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function regionHash(text) {
  return sha256(normalizeText(text));
}

function sectionRefForProvision(prov) {
  const features = (prov && prov.features) || {};
  const explicit = features.sectionNumber || prov.sectionNumber || prov.number || null;
  if (explicit) return /^section\b/i.test(String(explicit)) ? String(explicit) : `Section ${explicit}`;
  const text = String((prov && (prov.text || prov.full_text)) || '');
  const m = text.match(/\bSECTION\s+([0-9]+(?:\.[0-9]+)+)\b/i);
  return m ? `Section ${m[1]}` : null;
}

function canonicalInstrumentType(inst) {
  const code = String((inst && (inst.code || inst.instrumentType || inst.instrument)) || inst || '').trim();
  const upper = code.toUpperCase();
  if (upper === 'STOCK_OPTIONS' || upper === 'OPTIONS' || upper === 'OPTION') return 'STOCK_OPTIONS';
  if (upper === 'RESTRICTED_STOCK' || upper === 'RSA' || upper === 'RSAS') return 'RSA';
  if (upper === 'RSUS' || upper === 'RSU') return 'RSU';
  if (upper === 'PSUS' || upper === 'PSU') return 'PSU';
  if (upper === 'ESPP') return 'ESPP';
  if (upper === 'SARS' || upper === 'SAR') return 'SAR';
  if (upper === 'PHANTOM_STOCK') return 'PHANTOM_STOCK';
  if (upper === 'DEFERRED_COMPENSATION' || upper === 'DSU' || upper === 'DSUS') return 'DSU';
  return 'OTHER_EQUITY';
}

function displayInstrumentLabel(code) {
  if (code === 'RSA') return 'Restricted Stock Awards';
  if (code === 'RSU') return EQUITY_INSTRUMENTS.RSUs;
  if (code === 'PSU') return EQUITY_INSTRUMENTS.PSUs;
  if (code === 'SAR') return EQUITY_INSTRUMENTS.SARS;
  if (code === 'STOCK_OPTIONS') return EQUITY_INSTRUMENTS.STOCK_OPTIONS;
  if (code === 'ESPP') return EQUITY_INSTRUMENTS.ESPP;
  if (code === 'PHANTOM_STOCK') return EQUITY_INSTRUMENTS.PHANTOM_STOCK;
  return code.replace(/_/g, ' ');
}

function vestingTreatment(raw, instrumentType) {
  const code = String((raw && raw.code) || raw || '').toUpperCase();
  const text = `${raw && raw.text ? raw.text : ''} ${raw && raw.label ? raw.label : ''}`.toLowerCase();
  if (instrumentType === 'ESPP' && /\b(?:terminate|terminated|final\s+(?:investment|offering)|offering\s+period|purchase\s+period)\b/.test(text)) {
    return 'CANCELLED_NO_CONSIDERATION';
  }
  if (code.includes('ACCEL_ELSE_DOUBLE_TRIGGER') || /same\s+vesting\s+schedule|double[-\s]?trigger/.test(text)) {
    return 'CONTINUED_VESTING';
  }
  if (code.includes('ASSUM') || /\bassum/.test(text)) return 'ASSUMED_BY_PARENT';
  if (code.includes('CONTINU') || /\bcontin/.test(text)) return 'CONTINUED_VESTING';
  if (code.includes('PRO_RATA') || /pro[-\s]?rata/.test(text)) return 'PRO_RATA_ACCELERATION';
  if (code.includes('CANCELLED_NO') || code.includes('CANCELED_NO') || /without\s+(?:any\s+)?consideration|no\s+consideration/.test(text)) {
    return 'CANCELLED_NO_CONSIDERATION';
  }
  if (code.includes('ROLLOVER') || /\brollover\b/.test(text)) return 'ROLLOVER';
  if (code.includes('FULL') || code.includes('ACCEL') || /vest(?:ed)?\s+in\s+full|fully\s+vest/.test(text)) {
    return 'FULLY_VESTED_ACCELERATED';
  }
  if (instrumentType === 'STOCK_OPTIONS' && /cancel|cash|spread|exercise\s+price/.test(text)) {
    return 'CANCELLED_FOR_CONSIDERATION';
  }
  return 'UNSPECIFIED';
}

function considerationType(raw, instrumentType) {
  const code = String((raw && raw.code) || raw || '').toUpperCase();
  const text = `${raw && raw.text ? raw.text : ''} ${raw && raw.label ? raw.label : ''}`.toLowerCase();
  if (instrumentType === 'ESPP' && /\b(?:terminate|terminated|final\s+(?:investment|offering)|offering\s+period|purchase\s+period)\b/.test(text)) {
    return 'CANCELLATION';
  }
  if (code.includes('CASH') || code.includes('SPREAD') || /cash|spread|exercise\s+price|merger\s+consideration|per\s+share|cvr/.test(text)) {
    return 'CASH';
  }
  if (code.includes('NO_CONSIDERATION') || /without\s+(?:any\s+)?consideration|no\s+consideration/.test(text)) return 'CANCELLATION';
  if (code.includes('ASSUM') || /parent\s+(?:stock|equity|award)|buyer\s+(?:stock|equity|award)|assum/.test(text)) return 'STOCK';
  return 'N_A';
}

function cashFormula(raw, fallback) {
  const text = String((raw && raw.text) || fallback || '');
  if (!text) return null;
  if (/\bcash\b|exercise\s+price|spread|merger\s+consideration|per\s+share|refund/i.test(text)) return text;
  return null;
}

function stockFormula(raw) {
  const text = String((raw && raw.text) || '');
  if (!text) return null;
  if (/parent\s+(?:stock|equity|award)|buyer\s+(?:stock|equity|award)|exchange\s+ratio|assum/i.test(text)) return text;
  return null;
}

function performanceTreatment(raw, instrumentType) {
  const text = String((raw && raw.text) || raw || '').toLowerCase();
  if (instrumentType !== 'PSU') return null;
  if (/\bgreater\s+of\b/.test(text) && /target/.test(text) && /actual/.test(text)) return 'ACTUAL_PERFORMANCE';
  if (/\bhigher\s+of\b/.test(text) && /target/.test(text) && /actual/.test(text)) return 'ACTUAL_PERFORMANCE';
  if (/target/.test(text)) return 'DEEMED_TARGET';
  if (/maximum|max/.test(text)) return 'DEEMED_MAXIMUM';
  if (/actual/.test(text)) return 'ACTUAL_PERFORMANCE';
  if (/pro[-\s]?rata/.test(text)) return 'PRO_RATA';
  return 'N_A';
}

function priorMarkerStart(text, index) {
  const before = text.slice(Math.max(0, index - 300), index);
  const matches = [...before.matchAll(/\(([a-z]{1,5}|[ivx]{1,6})\)/gi)];
  if (!matches.length) return -1;
  const last = matches[matches.length - 1];
  return Math.max(0, index - before.length + last.index);
}

function markerAt(text, index) {
  const m = /^\(([a-z]{1,5}|[ivx]{1,6})\)/i.exec(text.slice(index, index + 16));
  return m ? index : -1;
}

function nextMarkerStart(text, from) {
  const tail = text.slice(from);
  const m = /\s\(([a-z]{1,5}|[ivx]{1,6})\)\s+(?=[A-Z])/i.exec(tail);
  return m ? from + m.index : -1;
}

function sentenceBounds(text, index) {
  const prev = text.lastIndexOf('. ', index);
  const next = text.indexOf('. ', index);
  return {
    start: prev >= 0 ? prev + 2 : 0,
    end: next >= 0 ? next + 1 : text.length,
  };
}

function locateInstrumentSpan(regionText, instrument, treatment) {
  const hint = String(
    (treatment && treatment.text) ||
    (instrument && instrument.text) ||
    displayInstrumentLabel(canonicalInstrumentType(instrument)),
  );
  let idx = hint ? regionText.indexOf(hint) : -1;
  const canonical = canonicalInstrumentType(instrument);
  if (idx < 0 && INSTRUMENT_RE[canonical]) {
    const m = INSTRUMENT_RE[canonical].exec(regionText);
    if (m) idx = m.index;
  }
  if (idx < 0) return { start: 0, end: regionText.length, spanType: 'SHARED_PARAGRAPH' };

  const markerStart = markerAt(regionText, idx) >= 0 ? idx : priorMarkerStart(regionText, idx);
  if (markerStart >= 0 && idx - markerStart <= 180) {
    const hintEnd = idx + hint.length;
    const next = nextMarkerStart(regionText, hintEnd);
    let end = next > markerStart ? next : Math.max(hintEnd, sentenceBounds(regionText, Math.max(idx, hintEnd - 1)).end);
    if (next < 0 && end - markerStart < 100) {
      const period = regionText.indexOf('. ', end + 1);
      end = period >= 0 ? period + 1 : regionText.length;
    }
    const spanText = regionText.slice(markerStart, end);
    const spanType = mentionedInstrumentTypes(spanText).size > 1 ? 'SHARED_PARAGRAPH' : 'OWN_SUBPROVISION';
    return {
      start: markerStart,
      end,
      spanType,
    };
  }

  const sentence = sentenceBounds(regionText, idx);
  const hintEnd = idx + hint.length;
  return {
    start: sentence.start,
    end: Math.max(sentence.end, hintEnd),
    spanType: 'SHARED_SENTENCE',
  };
}

function groupingForTreatments(treatments) {
  return classifyConsiderationGrouping('', treatments);
}

function uniqueInstruments(instruments) {
  const out = [];
  const seen = new Set();
  for (const inst of instruments || []) {
    const code = canonicalInstrumentType(inst);
    const text = String((inst && inst.text) || '');
    const key = `${code}::${text || displayInstrumentLabel(code)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(inst && typeof inst === 'object' ? inst : { code, label: displayInstrumentLabel(code), text });
  }
  return out;
}

function buildConsiderationEquityProvision(prov) {
  if (!prov || prov.code !== 'CONSID-EQUITY') return null;
  // Only CONSID-typed provisions are treatment carriers. Definitions are
  // routinely tagged with the topical code of the concept they define
  // (DEF rows carrying NOSOL-SUPERIOR etc.), so a DEF like
  // '"Company Equity Awards" means the Company Stock Options and the
  // Company Restricted Stock Units.' can arrive with code CONSID-EQUITY —
  // it names instruments but carries no treatment, and the instrument
  // backfill (extract.js) skips non-CONSID types for the same reason.
  // Mirror buildElectionCarrierProvision's gate.
  if (String(prov.type || '').toUpperCase() !== 'CONSID') return null;
  const features = prov.features || {};
  const regionFullText = String(prov.text || prov.full_text || '');
  if (!regionFullText.trim()) return null;
  const instruments = uniqueInstruments(
    Array.isArray(features.outstandingInstruments) && features.outstandingInstruments.length
      ? features.outstandingInstruments
      : (features.instrumentType ? [features.instrumentType] : []),
  );
  const treatments = Array.isArray(features.instrumentTreatments) ? features.instrumentTreatments : [];
  const vestings = Array.isArray(features.instrumentVesting) ? features.instrumentVesting : [];

  // Misclassified-carrier guard: the AI sometimes stamps CONSID-EQUITY on a
  // fragment that names NO equity instrument at all (withholding mechanics,
  // conversion boilerplate). With no instruments extracted AND none named in
  // the text, there is nothing an equity-treatment extraction could have
  // found — skip the conversion instead of failing the zero-treatments
  // invariant, which would abort the whole deal ingest. When the text DOES
  // name an instrument but instruments are still empty, that is a genuine
  // extraction failure and the invariant should (and will) fire.
  if (instruments.length === 0 && !hasAffirmativeInstrumentMention(regionFullText)) {
    console.warn(
      `[consideration-equity] skipping CONSID-EQUITY provision with no instrument mentions ` +
      `(${sectionRefForProvision(prov) || 'unknown section'}): "${regionFullText.slice(0, 120).replace(/\s+/g, ' ')}…"`,
    );
    return null;
  }

  const treatmentRows = instruments.map((instrument, i) => {
    const instrumentType = canonicalInstrumentType(instrument);
    const treatment = treatments.find((t) =>
      String(t && (t.instrumentCode || t.instrument || t.for || '')).toUpperCase() === String(instrument && instrument.code || '').toUpperCase(),
    ) || treatments[i] || features.equityAwardTreatment || null;
    const vesting = vestings.find((v) =>
      String(v && (v.instrumentCode || v.instrument || v.for || '')).toUpperCase() === String(instrument && instrument.code || '').toUpperCase(),
    ) || vestings[i] || features.vestingAcceleration || null;
    const span = locateInstrumentSpan(regionFullText, instrument, treatment);
    const sourceSpanStart = Math.max(0, span.start);
    const sourceSpanEnd = Math.min(regionFullText.length, Math.max(sourceSpanStart + 1, span.end));
    const quote = regionFullText.slice(sourceSpanStart, sourceSpanEnd);
    return {
      instrumentType,
      instrumentLabel: displayInstrumentLabel(instrumentType),
      vestingTreatment: vestingTreatment(vesting || treatment, instrumentType),
      considerationType: considerationType(treatment, instrumentType),
      cashFormula: cashFormula(treatment, features.cashOutAmount || features.optionSpread || features.espp_treatment),
      stockFormula: stockFormula(treatment),
      inTheMoneyOnly: instrumentType === 'STOCK_OPTIONS' ? /\bin[-\s]?the[-\s]?money|\bexcess\b|\bexercise\s+price/i.test(String(treatment && treatment.text || features.optionSpread || '')) : null,
      performanceTreatment: performanceTreatment(features.performanceTreatment || treatment, instrumentType),
      taxTreatmentNote: features.parachuteCap ? 'Subject to parachute payment cap / cutback language.' : null,
      spanType: span.spanType,
      sourceSpanStart,
      sourceSpanEnd,
      verbatimQuote: quote,
      bringDownSectionRef: null,
      bringDownVerbatimQuote: null,
      bringDownRegionId: null,
      confidence: span.spanType === 'OWN_SUBPROVISION' ? 'HIGH' : 'MEDIUM',
    };
  });

  const treatmentGrouping = groupingForTreatments(treatmentRows);
  const extracted = {
    provisionType: 'CONSID-EQUITY',
    sectionRef: sectionRefForProvision(prov),
    regionId: prov.regionId || prov.region_id || features.regionId || null,
    regionFullText,
    regionHash: regionHash(regionFullText),
    treatmentGrouping,
    extractedBy: 'CODEX',
    extractionVersion: EXTRACTION_VERSION,
    treatments: treatmentRows,
  };
  const electionMechanism = buildElectionMechanism(extracted);
  if (electionMechanism) {
    enforceElectionInvariants(electionMechanism, regionFullText);
    extracted.electionMechanism = electionMechanism;
  }
  return extracted;
}

function buildElectionCarrierProvision(prov) {
  if (!prov || prov.code === 'CONSID-EQUITY') return null;
  const type = String(prov.type || '').toUpperCase();
  if (type !== 'CONSID') return null;
  const regionFullText = String(prov.text || prov.full_text || '');
  if (!regionFullText.trim()) return null;
  const electionMechanism = buildElectionMechanism({ regionFullText });
  if (!electionMechanism) return null;
  enforceElectionInvariants(electionMechanism, regionFullText);
  return {
    provisionType: 'CONSID-ELECTION',
    sectionRef: sectionRefForProvision(prov),
    regionId: prov.regionId || prov.region_id || (prov.features && prov.features.regionId) || null,
    regionFullText,
    regionHash: regionHash(regionFullText),
    treatmentGrouping: 'GROUPED_PROSE',
    extractedBy: 'CODEX',
    extractionVersion: `${EXTRACTION_VERSION}-election`,
    treatments: [],
    electionMechanism,
  };
}

function enforceConsiderationEquityInvariants(extracted) {
  if (!extracted || !['CONSID-EQUITY', 'CONSID-ELECTION'].includes(extracted.provisionType)) return;
  if (extracted.electionMechanism) {
    enforceElectionInvariants(extracted.electionMechanism, extracted.regionFullText);
  }
  if (!Array.isArray(extracted.treatments) || extracted.treatments.length === 0) {
    if (extracted.provisionType === 'CONSID-ELECTION' && extracted.electionMechanism) return;
    const snippet = String(extracted.regionFullText || '').slice(0, 120).replace(/\s+/g, ' ');
    throw new Error(`CONSID-EQUITY invariant failed for ${extracted.sectionRef || 'unknown section'}: zero treatments (text: "${snippet}…")`);
  }
  for (const treatment of extracted.treatments) {
    const quote = extracted.regionFullText.slice(treatment.sourceSpanStart, treatment.sourceSpanEnd);
    if (quote !== treatment.verbatimQuote) {
      throw new Error(`CONSID-EQUITY quote fidelity violation for ${treatment.instrumentType} in ${extracted.sectionRef || 'unknown section'}`);
    }
  }
  if (extracted.treatmentGrouping === 'SEPARATE_SUBPROVISIONS') {
    const bad = extracted.treatments.find((t) => t.spanType !== 'OWN_SUBPROVISION');
    if (bad) throw new Error(`CONSID-EQUITY grouping invariant failed for ${bad.instrumentType}`);
  }
  if (extracted.treatmentGrouping === 'GROUPED_PROSE') {
    const bad = extracted.treatments.find((t) => !['SHARED_SENTENCE', 'SHARED_PARAGRAPH'].includes(t.spanType));
    if (bad) throw new Error(`CONSID-EQUITY grouping invariant failed for ${bad.instrumentType}`);
  }
  const spans = new Map();
  const treatmentKeys = new Set();
  for (const t of extracted.treatments) {
    const treatmentKey = `${t.instrumentType}:${t.sourceSpanStart}`;
    if (treatmentKeys.has(treatmentKey)) {
      throw new Error(`CONSID-EQUITY duplicate treatment key invariant failed for ${t.instrumentType}`);
    }
    treatmentKeys.add(treatmentKey);
    const key = `${t.sourceSpanStart}:${t.sourceSpanEnd}`;
    const prior = spans.get(key);
    if (prior && (prior.spanType === 'OWN_SUBPROVISION' || t.spanType === 'OWN_SUBPROVISION')) {
      throw new Error(`CONSID-EQUITY shared own-subprovision span invariant failed for ${t.instrumentType}`);
    }
    spans.set(key, t);
  }
}

function convertConsiderationEquityProvisions(provisions) {
  if (!Array.isArray(provisions)) return;
  for (const prov of provisions) {
    const extracted = buildConsiderationEquityProvision(prov) || buildElectionCarrierProvision(prov);
    if (!extracted) continue;
    enforceConsiderationEquityInvariants(extracted);
    prov.features = {
      ...(prov.features || {}),
      considerationEquity: extracted,
      considerationTreatments: extracted.treatments,
      treatmentGrouping: extracted.treatmentGrouping,
      regionHash: extracted.regionHash,
    };
  }
}

module.exports = {
  EXTRACTION_VERSION,
  INSTRUMENT_MENTION_RES,
  buildConsiderationEquityProvision,
  buildElectionCarrierProvision,
  canonicalInstrumentType,
  convertConsiderationEquityProvisions,
  enforceConsiderationEquityInvariants,
  groupingForTreatments,
  regionHash,
};
