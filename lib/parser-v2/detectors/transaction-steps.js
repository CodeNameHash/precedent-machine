const { deriveTopology, enforceTransactionStepInvariants } = require('../../schema/topology-detector');

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

function extractTransactionSteps(sections, opts = {}) {
  const allSections = Array.isArray(sections) ? sections : [];
  const focusSections = allSections.filter((section) => {
    const type = section.provision_type || section.provisionType || section.type || '';
    const title = `${section.title || section.heading || ''} ${section.sectionNumber || section.number || ''}`;
    return ['STRUCT', 'CONSID', 'DEF'].includes(type) || /recitals|merger|effect|conversion|offer|effective time/i.test(title);
  });
  const focusText = focusSections.map((s) => s.text || s.body || '').join('\n\n') || allSections.map((s) => s.text || s.body || '').join('\n\n');
  const lower = focusText.toLowerCase();

  const offerSignal = /\bacceptance\s+time\b|\b251\(h\)\b|\bthe\s+offer\b/i.test(focusText);
  const tenderSection = findSection(focusSections, [/acceptance\s+time/i, /\bthe\s+offer\b/i, /251\(h\)/i]);
  const mergerSection = findSection(focusSections, [/effective\s+time/i, /merger/i]) || tenderSection;
  if (offerSignal && !/\bfirst\s+merger\b|\bsecond\s+merger\b|\bsubsequent\s+merger\b/i.test(focusText)) {
    const steps = [
      stepBase(tenderSection, focusText, {
        step_order: 1,
        step_kind: 'TENDER_OFFER',
        disappearing_entity: 'Company Shares',
        surviving_entity: 'Company',
        effective_time_ref: 'Acceptance Time',
        effective_time_definition_quote: quoteAround(focusText, /acceptance\s+time/i),
        confidence: 'HIGH',
      }),
      stepBase(mergerSection, focusText, {
        step_order: 2,
        step_kind: 'BACK_END_MERGER',
        disappearing_entity: 'Merger Sub',
        surviving_entity: 'Company',
        effective_time_ref: 'Effective Time',
        effective_time_definition_quote: quoteAround(focusText, /effective\s+time/i),
        confidence: 'HIGH',
      }),
    ];
    return modelForSteps(steps, { needsReview: false });
  }

  const doubleDummySignal = /\bfirst\s+merger\b/i.test(focusText) && (/\bsecond\s+merger\b|\bsubsequent\s+merger\b|\bsecond\s+effective\s+time\b/i.test(focusText));
  if (doubleDummySignal) {
    const firstSection = findSection(focusSections, [/first\s+merger/i, /first\s+effective\s+time/i]) || mergerSection;
    const secondSection = findSection(focusSections, [/second\s+merger/i, /subsequent\s+merger/i, /second\s+effective\s+time/i]) || firstSection;
    const parentEntity = /\bholdco\b/i.test(focusText) ? 'HoldCo' : 'Parent';
    const steps = [
      stepBase(firstSection, focusText, {
        step_order: 1,
        step_kind: 'MERGER',
        disappearing_entity: 'Merger Sub 1',
        surviving_entity: 'First Surviving Corporation',
        parent_entity: parentEntity,
        effective_time_ref: /first\s+effective\s+time/i.test(focusText) ? 'First Effective Time' : 'Effective Time',
        effective_time_definition_quote: quoteAround(focusText, /first\s+effective\s+time|first\s+merger/i),
        confidence: /\bholdco\b|newly[-\s]formed/i.test(lower) ? 'HIGH' : 'MEDIUM',
      }),
      stepBase(secondSection, focusText, {
        step_order: 2,
        step_kind: 'SUBSEQUENT_MERGER',
        disappearing_entity: 'First Surviving Corporation',
        surviving_entity: 'Merger Sub 2',
        parent_entity: parentEntity,
        effective_time_ref: /second\s+effective\s+time/i.test(focusText) ? 'Second Effective Time' : 'Subsequent Merger Effective Time',
        effective_time_definition_quote: quoteAround(focusText, /second\s+effective\s+time|subsequent\s+merger|second\s+merger/i),
        confidence: 'HIGH',
      }),
    ];
    return modelForSteps(steps, { needsReview: false });
  }

  const singleSection = mergerSection || focusSections[0] || allSections[0] || null;
  const steps = [
    stepBase(singleSection, focusText, {
      step_order: 1,
      step_kind: 'MERGER',
      disappearing_entity: 'Merger Sub',
      surviving_entity: 'Company',
      effective_time_ref: 'Effective Time',
      effective_time_definition_quote: quoteAround(focusText, /effective\s+time|merger/i),
      confidence: 'MEDIUM',
    }),
  ];
  return modelForSteps(steps, { needsReview: false });
}

function modelForSteps(steps, opts = {}) {
  const topology = deriveTopology(steps, opts);
  const invariant = enforceTransactionStepInvariants(steps, topology);
  return {
    steps,
    topology: {
      ...topology,
      review_note: topology.review_note || (invariant.warnings.length ? invariant.warnings.join(' ') : null),
    },
    warnings: invariant.warnings,
  };
}

module.exports = {
  extractTransactionSteps,
  modelForSteps,
};
