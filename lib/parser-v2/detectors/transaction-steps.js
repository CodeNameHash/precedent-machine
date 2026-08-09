/**
 * lib/parser-v2/detectors/transaction-steps.js
 *
 * Deterministic regex/heading detector over STRUCT/CONSID/DEF section text.
 * Emits ordered transaction_steps + a topology classification via
 * lib/schema/topology-detector.js. No LLM call.
 *
 * Step 2X-F (PLAN.md / DECISIONS.md §14):
 * - No matched pattern → UNDETERMINED (never invent a silent SINGLE_MERGER).
 * - Tender signal requires Acceptance Time / 251(h) / "tender offer" — not bare
 *   "the offer" (Skechers antitrust false positive).
 * - Sequential two-step names come from the agreement's own defined terms
 *   (Titanium Merger / Forward Merger), not only "first/second merger".
 * - HoldCo → DOUBLE_DUMMY; otherwise sequential two-step →
 *   REVERSE_TRIANGULAR_THEN_LLC.
 * - Explicit simultaneity → PARALLEL_MERGERS (Modiv UPREIT).
 *
 * Detector-inferred results should be treated as low-trust corroboration
 * (Task 7.5): callers force topology_needs_review when step_source is
 * DETECTOR_INFERRED. Do not trust per-step confidence alone.
 */

'use strict';

const {
  TOPOLOGIES,
  CONCURRENCY,
  deriveTopology,
  enforceTransactionStepInvariants,
} = require('../../schema/topology-detector');
const {
  mergeDealTopologyAcrossCitedSections,
} = require('../../canonical-v2/deal-topology-from-claims');

function sectionRef(section) {
  const ref = section && (section.sectionNumber || section.number || section.section_ref);
  return ref ? (String(ref).toLowerCase().startsWith('section') ? String(ref) : `Section ${ref}`) : null;
}

function quoteAround(text, re, fallback = null) {
  const m = re.exec(text);
  if (!m) return fallback || text.slice(0, Math.min(text.length, 700)).trim();
  const start = Math.max(0, m.index - 180);
  let end = text.indexOf('. ', m.index + m[0].length);
  if (end < 0 || end - start > 1200) end = Math.min(text.length, m.index + 700);
  else end += 1;
  return text.slice(start, end).trim();
}

function findSection(sections, patterns) {
  const list = Array.isArray(patterns) ? patterns : [patterns];
  return (sections || []).find((section) => {
    const hay = `${section.sectionNumber || section.number || ''} ${section.title || section.heading || ''} ${section.text || ''}`;
    return list.some((re) => re.test(hay));
  }) || null;
}

function firstRegionId(section) {
  return section && (section.regionId || section.region_id || null);
}

function stepBase(section, text, overrides) {
  return {
    step_order: overrides.step_order,
    step_kind: overrides.step_kind,
    disappearing_entity: overrides.disappearing_entity,
    surviving_entity: overrides.surviving_entity,
    parent_entity: overrides.parent_entity || null,
    concurrency: overrides.concurrency || CONCURRENCY.SEQUENTIAL,
    step_name: overrides.step_name || null,
    effective_time_ref: overrides.effective_time_ref || sectionRef(section) || 'Effective Time',
    effective_time_definition_quote: overrides.effective_time_definition_quote || quoteAround(text, /effective\s+time|acceptance\s+time|first\s+merger|second\s+merger|subsequent\s+merger/i),
    is_taxable: overrides.is_taxable ?? null,
    tax_treatment_note: overrides.tax_treatment_note || null,
    region_id: firstRegionId(section),
    section_refs: [...new Set([sectionRef(section), ...(overrides.section_refs || [])].filter(Boolean))],
    extracted_by: 'CODEX',
    confidence: overrides.confidence || 'MEDIUM',
  };
}

/**
 * Agreement-defined merger names.
 *
 * Prefer quoted defined terms (“Titanium Merger”). Fall back to unquoted
 * “X Merger Effective Time” anchors — sectionized text often loses curly
 * quotes from the definitions article while keeping Effective-Time uses.
 * Drops Certificate/Articles of Merger noise.
 */
function findDefinedMergerNames(text) {
  const found = [];
  const push = (raw) => {
    const name = String(raw || '').replace(/\s+/g, ' ').trim();
    if (!name) return;
    if (/\b(?:Certificate|Certificates|Articles)\s+of\s+Merger\b/i.test(name)) return;
    if (/^Certificate of Merger$/i.test(name)) return;
    if (!found.some((f) => f.toLowerCase() === name.toLowerCase())) found.push(name);
  };

  const quoted = /[\u201C"]([^\u201D"]{1,60}?\s+Merger)[\u201D"]/g;
  let m;
  while ((m = quoted.exec(text))) push(m[1]);

  if (found.length < 2) {
    const effective = /\b((?:[A-Z][A-Za-z0-9./-]+)(?:\s+[A-Z][A-Za-z0-9./-]+){0,2})\s+Merger\s+Effective\s+Time\b/g;
    while ((m = effective.exec(text))) push(`${m[1]} Merger`);
  }

  const withEffectiveTime = found.filter((name) => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\s+Effective\\s+Time\\b`, 'i').test(text);
  });
  return withEffectiveTime.length >= 2 ? withEffectiveTime : found;
}

function hasSimultaneityLanguage(text) {
  // Merger-scoped only. Bare "simultaneously provided" (no-shop) and
  // stockholder-meeting "at the same time" false-fire on TopBuild.
  return /(?:Merger\s+Effective\s+Time|Company\s+Merger|OpCo\s+Merger).{0,160}(?:contemporaneous(?:ly)?|simultaneous(?:ly)?)/is.test(text)
    || /(?:contemporaneous(?:ly)?|simultaneous(?:ly)?).{0,160}(?:Merger\s+Effective\s+Time|Company\s+Merger|OpCo\s+Merger)/is.test(text)
    || /\boccurring\s+contemporaneous(?:ly)?\s+with\b/i.test(text);
}

function hasSequentialChainLanguage(text) {
  return /\bFirst\s+Surviving\b|\bSecond\s+Effective\s+Time\b|\bSubsequent\s+Merger\b|\bFirst\s+Surviving\s+Corporation\b|\bTitanium\s+Surviving\s+Corporation\b/i.test(text)
    || /\bimmediately\s+(?:following|thereafter)\s+(?:the\s+)?(?:First|Titanium)\s+(?:Merger|Effective\s+Time)\b/i.test(text);
}

function mergeActionNearName(text, mergerName) {
  const escaped = mergerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const named = new RegExp(`${escaped}[^.]{0,240}\\b(?:shall|will)\\s+be\\s+merged\\s+with\\s+and\\s+into\\b[^.]{0,160}`, 'i');
  const m = named.exec(text);
  if (m) return m[0];
  // Fallback: any merge-action sentence that mentions the merger name nearby.
  const loose = new RegExp(`[^.]*\\b${escaped}\\b[^.]*\\bmerged\\s+with\\s+and\\s+into\\b[^.]*\\.`, 'i');
  const m2 = loose.exec(text);
  return m2 ? m2[0] : null;
}

function entitiesFromMergeSentence(sentence, fallbackDisappearing, fallbackSurviving) {
  if (typeof sentence !== 'string') {
    return { disappearing_entity: fallbackDisappearing, surviving_entity: fallbackSurviving };
  }
  const m = sentence.match(/\b([A-Z][^.]{0,80}?)\s+(?:shall|will)\s+be\s+merged\s+with\s+and\s+into\s+([^.,;]+)/i)
    || sentence.match(/\b([A-Z][^.]{0,80}?)\s+shall\s+merge\s+with\s+and\s+into\s+([^.,;]+)/i);
  if (!m) {
    return { disappearing_entity: fallbackDisappearing, surviving_entity: fallbackSurviving };
  }
  return {
    disappearing_entity: m[1].replace(/^the\s+/i, '').trim(),
    surviving_entity: m[2].replace(/^the\s+/i, '').trim(),
  };
}

function extractDetectorTransactionSteps(sections, opts = {}) {
  const allSections = Array.isArray(sections) ? sections : [];
  const focusSections = allSections.filter((section) => {
    const type = section.provision_type || section.provisionType || section.type || '';
    const title = `${section.title || section.heading || ''} ${section.sectionNumber || section.number || ''}`;
    return ['STRUCT', 'CONSID', 'DEF'].includes(type) || /recitals|merger|effect|conversion|offer|effective time/i.test(title);
  });
  const focusText = focusSections.map((s) => s.text || s.body || '').join('\n\n') || allSections.map((s) => s.text || s.body || '').join('\n\n');
  // Prefer caller-supplied full cleaned text (keeps definition curly quotes
  // that sectionization sometimes drops). Else join all section bodies.
  const allText = (typeof opts.fullCleanedText === 'string' && opts.fullCleanedText.length > 0)
    ? opts.fullCleanedText
    : (allSections.map((s) => s.text || s.body || '').join('\n\n') || focusText);
  const lower = allText.toLowerCase();

  // Step 2X-F: tender only on Acceptance Time / 251(h). Bare "the offer" and
  // no-shop "tender offer or exchange offer" boilerplate false-fire on every
  // deal in the corpus (concho/metsera/skechers/topbuild/modiv).
  const offerSignal = /\bacceptance\s+time\b|\b251\(h\)\b/i.test(allText);
  const tenderSection = findSection(focusSections.length ? focusSections : allSections, [/acceptance\s+time/i, /251\(h\)/i]);
  const mergerSection = findSection(focusSections.length ? focusSections : allSections, [/effective\s+time/i, /merger/i]) || tenderSection;
  if (offerSignal && !/\bfirst\s+merger\b|\bsecond\s+merger\b|\bsubsequent\s+merger\b/i.test(allText)) {
    const steps = [
      stepBase(tenderSection, allText, {
        step_order: 1,
        step_kind: 'TENDER_OFFER',
        disappearing_entity: 'Company Shares',
        surviving_entity: 'Company',
        effective_time_ref: 'Acceptance Time',
        effective_time_definition_quote: quoteAround(allText, /acceptance\s+time|tender\s+offer/i),
        confidence: 'HIGH',
      }),
      stepBase(mergerSection, allText, {
        step_order: 2,
        step_kind: 'BACK_END_MERGER',
        disappearing_entity: 'Merger Sub',
        surviving_entity: 'Company',
        effective_time_ref: 'Effective Time',
        effective_time_definition_quote: quoteAround(allText, /effective\s+time/i),
        confidence: 'HIGH',
      }),
    ];
    return modelForSteps(steps, { needsReview: false, step_source: 'DETECTOR_INFERRED' });
  }

  const ordinalDoubleDummy = /\bfirst\s+merger\b/i.test(allText)
    && (/\bsecond\s+merger\b|\bsubsequent\s+merger\b|\bsecond\s+effective\s+time\b/i.test(allText));
  const definedNames = findDefinedMergerNames(allText);
  const nonOrdinalNames = definedNames.filter((n) => !/^(?:First|Second|Subsequent)\s+Merger$/i.test(n));
  const holdCo = /\bholdco\b/i.test(allText);
  const sectionsForFind = focusSections.length ? focusSections : allSections;

  if (ordinalDoubleDummy) {
    const firstSection = findSection(sectionsForFind, [/first\s+merger/i, /first\s+effective\s+time/i]) || mergerSection;
    const secondSection = findSection(sectionsForFind, [/second\s+merger/i, /subsequent\s+merger/i, /second\s+effective\s+time/i]) || firstSection;
    const parentEntity = holdCo ? 'HoldCo' : 'Parent';
    const steps = [
      stepBase(firstSection, allText, {
        step_order: 1,
        step_kind: 'MERGER',
        step_name: 'First Merger',
        disappearing_entity: 'Merger Sub 1',
        surviving_entity: 'First Surviving Corporation',
        parent_entity: parentEntity,
        effective_time_ref: /first\s+effective\s+time/i.test(allText) ? 'First Effective Time' : 'Effective Time',
        effective_time_definition_quote: quoteAround(allText, /first\s+effective\s+time|first\s+merger/i),
        confidence: holdCo || /newly[-\s]formed/i.test(lower) ? 'HIGH' : 'MEDIUM',
      }),
      stepBase(secondSection, allText, {
        step_order: 2,
        step_kind: 'SUBSEQUENT_MERGER',
        step_name: /\bsubsequent\s+merger\b/i.test(allText) ? 'Subsequent Merger' : 'Second Merger',
        disappearing_entity: 'First Surviving Corporation',
        surviving_entity: 'Merger Sub 2',
        parent_entity: parentEntity,
        effective_time_ref: /second\s+effective\s+time/i.test(allText) ? 'Second Effective Time' : 'Subsequent Merger Effective Time',
        effective_time_definition_quote: quoteAround(allText, /second\s+effective\s+time|subsequent\s+merger|second\s+merger/i),
        confidence: 'HIGH',
      }),
    ];
    return modelForSteps(steps, {
      needsReview: false,
      holdCo,
      step_source: 'DETECTOR_INFERRED',
    });
  }

  // Named multi-merger (TopBuild Titanium/Forward; Modiv Company/OpCo).
  // Simultaneity wins over generic "immediately following" boilerplate when
  // the agreement defines two non-ordinal mergers (Modiv UPREIT).
  if (nonOrdinalNames.length >= 2) {
    const nameA = nonOrdinalNames[0];
    const nameB = nonOrdinalNames[1];
    const parallel = hasSimultaneityLanguage(allText);
    const sequential = !parallel && (
      hasSequentialChainLanguage(allText) || nonOrdinalNames.length >= 2
    );
    const sectionA = findSection(sectionsForFind, [new RegExp(nameA.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')]) || mergerSection;
    const sectionB = findSection(sectionsForFind, [new RegExp(nameB.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')]) || sectionA;
    const sentenceA = mergeActionNearName(allText, nameA);
    const sentenceB = mergeActionNearName(allText, nameB);

    if (parallel) {
      const entA = entitiesFromMergeSentence(sentenceA, 'Company', 'Company Merger Sub');
      const entB = entitiesFromMergeSentence(sentenceB, 'OpCo Merger Sub', 'Partnership');
      const steps = [
        stepBase(sectionA, allText, {
          step_order: 1,
          step_kind: 'MERGER',
          step_name: nameA,
          concurrency: CONCURRENCY.PARALLEL,
          disappearing_entity: entA.disappearing_entity,
          surviving_entity: entA.surviving_entity,
          parent_entity: 'Parent',
          effective_time_ref: `${nameA} Effective Time`,
          effective_time_definition_quote: quoteAround(allText, new RegExp(nameA.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')),
          confidence: 'HIGH',
        }),
        stepBase(sectionB, allText, {
          step_order: 2,
          step_kind: 'MERGER',
          step_name: nameB,
          concurrency: CONCURRENCY.PARALLEL,
          disappearing_entity: entB.disappearing_entity,
          surviving_entity: entB.surviving_entity,
          parent_entity: 'Parent',
          effective_time_ref: `${nameB} Effective Time`,
          effective_time_definition_quote: quoteAround(allText, new RegExp(nameB.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')),
          confidence: 'HIGH',
        }),
      ];
      return modelForSteps(steps, {
        needsReview: false,
        parallel: true,
        step_source: 'DETECTOR_INFERRED',
      });
    }

    if (sequential) {
      // Prefer post-merger survivor naming when the text supplies it.
      const survivorName = (/\bTitanium\s+Surviving\s+Corporation\b/i.test(allText) && /Titanium/i.test(nameA))
        ? 'Titanium Surviving Corporation'
        : (/\bFirst\s+Surviving\s+Corporation\b/i.test(allText)
          ? 'First Surviving Corporation'
          : `${nameA.replace(/\s+Merger$/i, '')} Surviving Corporation`);
      const entA = entitiesFromMergeSentence(sentenceA, 'Merger Sub 1', survivorName);
      const entB = entitiesFromMergeSentence(sentenceB, survivorName, 'Merger Sub 2');
      // Force chain continuity for the sequential label when the second
      // sentence's disappearing entity is the defined survivor of step 1.
      if (/\bsurviving\b/i.test(entA.surviving_entity) || entA.surviving_entity === survivorName) {
        entB.disappearing_entity = entA.surviving_entity;
      } else {
        entA.surviving_entity = survivorName;
        entB.disappearing_entity = survivorName;
      }
      const steps = [
        stepBase(sectionA, allText, {
          step_order: 1,
          step_kind: 'MERGER',
          step_name: nameA,
          disappearing_entity: entA.disappearing_entity,
          surviving_entity: entA.surviving_entity,
          parent_entity: holdCo ? 'HoldCo' : 'Parent',
          effective_time_ref: `${nameA} Effective Time`,
          effective_time_definition_quote: quoteAround(allText, new RegExp(nameA.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')),
          confidence: 'HIGH',
        }),
        stepBase(sectionB, allText, {
          step_order: 2,
          step_kind: 'SUBSEQUENT_MERGER',
          step_name: nameB,
          disappearing_entity: entB.disappearing_entity,
          surviving_entity: entB.surviving_entity,
          parent_entity: holdCo ? 'HoldCo' : 'Parent',
          effective_time_ref: `${nameB} Effective Time`,
          effective_time_definition_quote: quoteAround(allText, new RegExp(nameB.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')),
          confidence: 'HIGH',
        }),
      ];
      return modelForSteps(steps, {
        needsReview: false,
        holdCo,
        step_source: 'DETECTOR_INFERRED',
      });
    }
  }

  // Affirmative single-step only — never the unconditional default.
  const singleMergerSignal = /\b(?:shall|will)\s+be\s+merged\s+with\s+and\s+into\b/i.test(allText)
    || /\bshall\s+merge\s+with\s+and\s+into\b/i.test(allText);
  if (singleMergerSignal && nonOrdinalNames.length <= 1) {
    const singleSection = mergerSection || focusSections[0] || allSections[0] || null;
    const steps = [
      stepBase(singleSection, allText, {
        step_order: 1,
        step_kind: 'MERGER',
        step_name: nonOrdinalNames[0] || 'The Merger',
        disappearing_entity: 'Merger Sub',
        surviving_entity: 'Company',
        effective_time_ref: 'Effective Time',
        effective_time_definition_quote: quoteAround(allText, /effective\s+time|merger/i),
        confidence: 'MEDIUM',
      }),
    ];
    return modelForSteps(steps, { needsReview: false, step_source: 'DETECTOR_INFERRED' });
  }

  return modelForSteps([], {
    needsReview: true,
    reviewNote: 'No transaction-step pattern matched.',
    step_source: 'DETECTOR_INFERRED',
  });
}

function extractTransactionSteps(sections, opts = {}) {
  const detectorModel = extractDetectorTransactionSteps(sections, opts);
  const merged = mergeDealTopologyAcrossCitedSections({
    modelClaims: opts.resolvedModelClaims || [],
    detectorSteps: detectorModel.steps,
  });
  return {
    steps: merged.transaction_steps,
    topology: {
      topology: merged.topology,
      step_count: merged.step_count,
      primary_step_order: merged.primary_step_order,
      topology_needs_review: merged.topology_needs_review,
      review_note: merged.review_note,
      step_source: merged.step_source,
    },
    warnings: merged.warnings,
  };
}

function modelForSteps(steps, opts = {}) {
  if (!Array.isArray(steps) || steps.length === 0) {
    return {
      steps: [],
      topology: {
        topology: TOPOLOGIES.UNDETERMINED,
        step_count: 0,
        primary_step_order: null,
        topology_needs_review: true,
        review_note: opts.reviewNote || 'No transaction steps detected.',
        step_source: opts.step_source || null,
      },
      warnings: [],
    };
  }
  const topology = deriveTopology(steps, opts);
  const invariant = enforceTransactionStepInvariants(steps, topology);
  // Detector-inferred rows are always review-flagged (Task 7.5): the detector
  // once reported HIGH confidence on a confirmed Skechers false positive.
  const needsReview = opts.step_source === 'DETECTOR_INFERRED'
    ? true
    : Boolean(topology.topology_needs_review);
  return {
    steps,
    topology: {
      ...topology,
      topology_needs_review: needsReview,
      review_note: topology.review_note || (invariant.warnings.length ? invariant.warnings.join(' ') : null),
      step_source: opts.step_source || null,
    },
    warnings: invariant.warnings,
  };
}

module.exports = {
  extractTransactionSteps,
  extractDetectorTransactionSteps,
  modelForSteps,
  findDefinedMergerNames,
};
