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

// Work package 48 (the review of 2026-10-25, finding 6): the list missed
// load-bearing M&A verbs — "undertakes to indemnify, defend and hold
// harmless" is an obligation and named none of the first list's words.
const OPERATIVE_VERB = /\b(?:shall|must|will|may not|might not|agrees?|agreed|covenants?|represents?|warrants?|terminate[sd]?|termination|entitled|obligat(?:e|es|ed|ion)|undertak(?:e|es|en)|indemnif(?:y|ies|ied)|waiv(?:e|es|ed|er)|consents?|consented|grant(?:s|ed)?|assign(?:s|ed)?|acknowledg(?:e|es|ed)|is required to|are required to|has the right to|have the right to)\b/i;
const DEFAULTS = Object.freeze({ minBytes: 80 });

// A section's sentences with their byte offsets inside the canonical text.
// The splitter keeps a full stop, question or exclamation mark with its own
// sentence, with any closing quote or bracket after it, and a sentence runs
// to the end of the text when it has no closing mark. A mark followed by a
// character is not a boundary: "Section 5.16" is one sentence's words, not
// "Section 5." and "16 ...". Offsets are byte offsets from the span's start,
// measured on the original text (a page footer inside a sentence stays part
// of it; the page hides it for display).
function sentenceByteSpans(text, startByte = 0) {
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
    const before = value.slice(0, match.index);
    // An abbreviation's own full stop ("the U.S. Food and Drug
    // Administration") and an SEC page footer printed on a line of its own
    // ("12." between two lines) are not sentence ends; a boundary there
    // would show the lawyer a fragment (the review of 2026-10-25, finding
    // 10).
    const lastToken = (/(\S+)$/.exec(before) || [])[1] || '';
    const abbreviation = /^(?:[A-Za-z]\.)+[A-Za-z]?\.$/.test(lastToken + match[0]);
    const footer = /(?:^|\n)\s*\d{1,3}$/.test(before);
    if (abbreviation || footer) continue;
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

// A component with a byte range cites the bytes; a component whose range was
// lost (a held fact keeps its text without offsets, found by the review of
// 2026-10-25, finding 8) cites the sentence its words appear in, so a held
// fact is not reported as no fact at all. An inverted range is ignored.
const TEXT_CITATION_MIN_LENGTH = 20;

function componentCitations(proposals) {
  const ranges = [];
  const texts = [];
  for (const proposal of proposals || []) {
    for (const component of walkComponents(proposal.components)) {
      if (Number.isSafeInteger(component.start_byte) && Number.isSafeInteger(component.end_byte)) {
        if (component.end_byte > component.start_byte) ranges.push([component.start_byte, component.end_byte]);
      } else if (typeof component.text === 'string' && component.text.trim().length >= TEXT_CITATION_MIN_LENGTH) {
        texts.push(component.text.trim());
      }
    }
  }
  return { ranges, texts };
}

// One section's uncited operative sentences.
function uncitedSectionSentences({ sectionText, startByte = 0, proposals = [], minBytes = DEFAULTS.minBytes }) {
  const { ranges, texts } = componentCitations(proposals);
  return sentenceByteSpans(sectionText, startByte)
    .filter((sentence) => sentence.end - sentence.start >= minBytes && OPERATIVE_VERB.test(sentence.text))
    .filter((sentence) => !ranges.some(([start, end]) => start < sentence.end && end > sentence.start))
    .filter((sentence) => !texts.some((text) => sentence.text.includes(text)))
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
