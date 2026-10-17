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
// A page number ("-43-") or a front-matter roman numeral ("-ii-").
const PAGE_FOOTER = /[ \t]*\n(?:[ \t]*\n)*[ \t]*-[ \t]?(?:\d{1,3}|[ivxlc]{1,6})[ \t]?-[ \t]*\n(?:[ \t]*\n)*[ \t]*/g;
const SENTENCE_END = /[.;:!?]["”’')\]]*$/;
const PARAGRAPH_START = /^(?:\([a-z0-9]{1,4}\)|[A-Z]?[a-z]*\s?\d|ARTICLE|Section|SECTION|Article)/;

function hidePageFooters(text) {
  if (typeof text !== 'string' || text.indexOf('-') === -1) return text;
  return text.replace(PAGE_FOOTER, (match, offset, whole) => {
    const before = whole.slice(0, offset);
    const after = whole.slice(offset + match.length);
    const paragraphBreak = /\n[ \t]*\n/.test(match) && (SENTENCE_END.test(before.trimEnd()) || PARAGRAPH_START.test(after));
    if (offset === 0 || after.length === 0) return paragraphBreak ? '\n\n' : (offset === 0 ? '' : '');
    return paragraphBreak ? '\n\n' : ' ';
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

module.exports = { hidePageFooters, factWithoutPageFooters, PAGE_FOOTER };
