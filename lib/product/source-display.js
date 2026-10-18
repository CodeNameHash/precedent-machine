'use strict';

// Display-only rules for source words. The canonical text keeps the SEC
// HTML's page footers ("-43-" on a line of its own between the words of a
// sentence that runs across a page); spans, hashes and quotes stand on that
// text, so the footers are never removed from it. They are hidden where the
// words are shown: the clause and source panes, the interpretation tree,
// the as-drafted footers and summaries built from component text. Ben,
// 2026-10-17, on the sidebar: "not formatted very prettily and also random
// page breaks and pagen umbers...!" (plan finding (42)).
// The footer and the blank lines the page break put around it. Between
// the words of one sentence it becomes a space; after a sentence end (or
// before a new lettered limb or section) the paragraph break stays, once.
// A page number ("-43-") or a front-matter roman numeral ("-ii-"), or a
// bare page number on a line of its own ("\n34\n": the NCS filing's
// footers, generation 5, 2026-10-18; work package 20 (b)).
const FOOTER_TOKEN = '(?:-[ \\t]?(?:\\d{1,3}|[ivxlc]{1,6})[ \\t]?-|\\d{1,3})';
const PAGE_FOOTER = new RegExp(`[ \\t]*\\n(?:[ \\t]*\\n)*[ \\t]*${FOOTER_TOKEN}[ \\t]*\\n(?:[ \\t]*\\n)*[ \\t]*`, 'g');
// One footer line between two newlines, for a quote matched across it
// (lib/product/agreement-draft.js resolveEvidenceQuote, work package 20 (b)).
const FOOTER_LINE = new RegExp(`\\n[ \\t]*${FOOTER_TOKEN}[ \\t]*\\n`);
// The same footer line with the whitespace around it, as the gap between
// two words of a quote (source, for building a pattern from the quote).
const FOOTER_GAP = `\\s*\\n[ \\t]*${FOOTER_TOKEN}[ \\t]*\\n\\s*`;
const SENTENCE_END = /[.;:!?]["”’')\]]*$/;
const PARAGRAPH_START = /^(?:\([a-z0-9]{1,4}\)|[A-Z]?[a-z]*\s?\d|ARTICLE|Section|SECTION|Article)/;

function hidePageFooters(text) {
  if (typeof text !== 'string' || text.indexOf('\n') === -1) return text;
  return text.replace(PAGE_FOOTER, (match, offset, whole) => {
    const before = whole.slice(0, offset);
    const after = whole.slice(offset + match.length);
    const blankLines = /\n[ \t]*\n/.test(match);
    const sentenceEnded = SENTENCE_END.test(before.trimEnd());
    const paragraphStarts = PARAGRAPH_START.test(after);
    // With blank lines around the footer (Metsera's layout) either sign of
    // a paragraph boundary keeps the break; a footer between single
    // newlines (NCS's layout, work package 20 (b)) keeps one newline only
    // when the sentence ended before it and a paragraph starts after it.
    const paragraphBreak = blankLines ? (sentenceEnded || paragraphStarts) : (sentenceEnded && paragraphStarts);
    const kept = blankLines ? '\n\n' : '\n';
    if (offset === 0 || after.length === 0) return paragraphBreak && offset !== 0 ? kept : '';
    return paragraphBreak ? kept : ' ';
  });
}

// A fact whose component texts are shown without page footers; every
// other field (bytes, spans, ids) is the original's.
function factWithoutPageFooters(fact) {
  if (!fact || !Array.isArray(fact.components)) return fact;
  const mapComponents = (components) => {
    const mapped = components.map((component) => {
      if (!component || typeof component !== 'object') return component;
      const text = hidePageFooters(component.text);
      const children = Array.isArray(component.children) ? mapComponents(component.children) : component.children;
      return text === component.text && children === component.children ? component : { ...component, text, children };
    });
    return mapped.every((component, index) => component === components[index]) ? components : mapped;
  };
  const components = mapComponents(fact.components);
  return components === fact.components ? fact : { ...fact, components };
}

module.exports = { hidePageFooters, factWithoutPageFooters, PAGE_FOOTER, FOOTER_LINE, FOOTER_GAP };
