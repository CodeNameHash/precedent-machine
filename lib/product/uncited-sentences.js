'use strict';

// The sentence-level silent-absence read of a finished run (work package 43,
// plan finding (260)).
//
// The page's "sections with no facts" block (work package 33) catches a
// section that returned nothing at all. The thin-answer guard catches an
// answer that leaves most of a section's bytes uncited at extraction time.
// Neither answers the question a lawyer asks of a finished page: "is there a
// sentence here that states an obligation and that no fact cites at all?" On
// DeepSeek 34847358 the section-level read named 5.16 and 3.30, and this
// read finds one more: a sentence of 5.4(a) that no fact's components touch.
// On Claude 88d4032a it finds none in any section. It is a read, not a gate:
// a sentence can be cited only as context for another fact, and a section
// can state its effect in words my verbs do not name, so the output is a
// list to read, never a failure.
//
// The rule: a sentence of the section's own text (the full-section span) of
// at least `minBytes` bytes that names an operative or representational verb
// and whose bytes are not overlapped by any component of any proposal of the
// section. A component overlapping the sentence — even as inherited
// CHAPEAU, INTRO or DEFINITION context — counts as cited: the fact tree
// quotes those words.

const OPERATIVE_VERB = /\b(?:shall|must|will|may not|might not|agrees?|agreed|covenants?|represents?|warrants?|terminate[sd]?|termination|entitled|obligat(?:e|es|ed|ion))\b/i;
const DEFAULTS = Object.freeze({ minBytes: 80 });

// A section's sentences with their byte offsets inside the canonical text.
// The splitter keeps a full stop, question or exclamation mark with its own
// sentence, with any closing quote or bracket after it, and a sentence runs
// to the end of the text when it has no closing mark. A mark followed by a
// character is not a boundary: "Section 5.16" is one sentence's words, not
// "Section 5." and "16 ...". Offsets are byte offsets from the span's start,
// measured on the original text (a page footer inside a sentence stays part
// of it; the page hides it for display).
function sentenceByteSpans(text, startByte) {
  const value = String(text || '');
  const spans = [];
  // A sentence ends at a full stop, question or exclamation mark followed by
  // whitespace or the end of the text, with any closing quote or bracket
  // after it. A mark followed by a character is not a boundary ("Section
  // 5.16" is one sentence's words), which a running scan sees and a
  // split-on-every-mark regex cannot.
  const boundary = /[.!?]+["\u201d\u2019')\]]*(?=\s|$)/g;
  const push = (from, to) => {
    const raw = value.slice(from, to);
    const trimmed = raw.trim();
    if (!trimmed) return;
    const at = from + raw.indexOf(trimmed);
    spans.push({
      text: trimmed,
      start: startByte + Buffer.byteLength(value.slice(0, at), 'utf8'),
      end: startByte + Buffer.byteLength(value.slice(0, at + trimmed.length), 'utf8'),
    });
  };
  let from = 0;
  let match;
  while ((match = boundary.exec(value))) {
    const to = match.index + match[0].length;
    push(from, to);
    from = to;
  }
  if (from < value.length) push(from, value.length);
  return spans;
}

function* walkComponents(components) {
  for (const component of components || []) {
    yield component;
    yield* walkComponents(component.children);
  }
}

function componentRanges(proposals) {
  const ranges = [];
  for (const proposal of proposals || []) {
    for (const component of walkComponents(proposal.components)) {
      if (Number.isSafeInteger(component.start_byte) && Number.isSafeInteger(component.end_byte)) {
        ranges.push([component.start_byte, component.end_byte]);
      }
    }
  }
  return ranges;
}

// One section's uncited operative sentences.
function uncitedSectionSentences({ sectionText, startByte = 0, proposals = [], minBytes = DEFAULTS.minBytes }) {
  const ranges = componentRanges(proposals);
  return sentenceByteSpans(sectionText, startByte)
    .filter((sentence) => sentence.end - sentence.start >= minBytes && OPERATIVE_VERB.test(sentence.text))
    .filter((sentence) => !ranges.some(([start, end]) => start < sentence.end && end > sentence.start))
    .map((sentence) => ({ text: sentence.text, start_byte: sentence.start, end_byte: sentence.end }));
}

// The same read over an analysis read (`getAgreementAnalysis` /
// `buildPreviewWorkspace`'s `analysis`): one row per section with any
// uncited operative sentence, in section order.
function uncitedOperativeSentences({ analysis, minBytes = DEFAULTS.minBytes }) {
  const spansById = new Map((analysis?.spans || []).map((span) => [span.span_id, span]));
  const closuresByNode = new Map((analysis?.source_closures || []).map((closure) => [closure.structure_node_id, closure]));
  const proposalsByNode = new Map();
  for (const proposal of analysis?.proposals || []) {
    if (!proposalsByNode.has(proposal.structure_node_id)) proposalsByNode.set(proposal.structure_node_id, []);
    proposalsByNode.get(proposal.structure_node_id).push(proposal);
  }
  const sections = [];
  for (const routing of analysis?.sections || []) {
    const reference = String(routing.section_reference || '');
    if (!reference || /-INTRO$/.test(reference) || reference.includes('::') || /^(?:Exhibit|Annex)-/i.test(reference)) continue;
    const closure = closuresByNode.get(routing.structure_node_id);
    const span = closure ? spansById.get(closure.full_section_span_id) : null;
    if (!span || typeof span.exact_text !== 'string') continue;
    const sentences = uncitedSectionSentences({
      sectionText: span.exact_text,
      startByte: Number(span.start_byte) || 0,
      proposals: proposalsByNode.get(routing.structure_node_id) || [],
      minBytes,
    });
    if (sentences.length) sections.push({ section_reference: reference, structure_node_id: routing.structure_node_id, sentences });
  }
  return sections;
}

function renderUncitedReport(sections) {
  if (sections.length === 0) return 'No section has an uncited operative sentence.';
  const lines = [];
  const total = sections.reduce((sum, section) => sum + section.sentences.length, 0);
  lines.push(`${total} uncited operative sentence${total === 1 ? '' : 's'} in ${sections.length} section${sections.length === 1 ? '' : 's'}:`, '');
  for (const section of sections) {
    lines.push(`§ ${section.section_reference} (${section.sentences.length})`);
    for (const sentence of section.sentences) lines.push(`  [${sentence.start_byte}-${sentence.end_byte}] ${sentence.text.replace(/\s+/g, ' ').slice(0, 200)}`);
    lines.push('');
  }
  return lines.join('\n');
}

module.exports = {
  DEFAULTS,
  OPERATIVE_VERB,
  sentenceByteSpans,
  uncitedSectionSentences,
  uncitedOperativeSentences,
  renderUncitedReport,
};
