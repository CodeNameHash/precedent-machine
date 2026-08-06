'use strict';

// Decides what an SEC exhibit actually is: an original merger agreement, an
// amended and restated agreement (a complete document that supersedes an
// earlier one), an amendment (which modifies specific sections of an agreement
// filed elsewhere), or something it cannot place. It fails closed: an exhibit
// it cannot place is AMBIGUOUS for a human, never a guess.
//
// Calibration comes from the pinned real exhibits in this repository, not from
// imagination:
//
//   * In all four pinned originals (TopBuild, Modiv, Skechers, Landos/AbbVie)
//     the loose phrase "amended and restated" appears 5-11 times, the earliest
//     at offset 5,372, and every early occurrence describes a charter, bylaws
//     or an LLC agreement rather than the merger agreement. Skechers has
//     "Amended and Restated Parent LLCA" roughly 60 characters before the words
//     "AGREEMENT AND PLAN OF MERGER" in its exhibit list. So the restatement
//     signal demands the phrase run straight into the agreement's own name,
//     with nothing in between, inside the caption window.
//   * In those same four documents the operative amendment verbs ("is hereby
//     amended", "amended to read as follows") never appear at all, at any
//     offset. They are therefore high-precision evidence of an amendment.
//   * Their captions sit at offsets 56-406 and their tables of contents start
//     at 233-581, so a 2,000-character caption window covers the naming of
//     every real original with margin to spare and stops well short of the
//     first trap at 5,372.
//   * They carry 7-11 distinct articles and run 381k-428k characters. A real
//     amendment carries none and runs a few thousand.
//
// Ambiguity means the revision signals conflict or run out: a document named as
// one thing and shaped like another, or named as both. It does not mean "this
// document looks odd". A document that names no revision and uses no amendment
// language is an original, because absence of that evidence is evidence of
// absence; whether it is long enough to be an agreement at all is a separate
// question the caller already gates on length.
//
// The one classification this module cannot check against a real fixture is a
// full restatement: no amended and restated merger agreement exists in the
// corpus yet.

const REVISION = Object.freeze({
  ORIGINAL: 'original',
  AMENDED_AND_RESTATED: 'amended_and_restated',
  AMENDMENT: 'amendment',
  AMBIGUOUS: 'ambiguous',
  UNKNOWN: 'unknown',
});

// Naming lives in the caption; a wider window starts catching the table of
// contents and the annexed forms, which is where the false positives are.
const CAPTION_WINDOW = 2000;
// Operative amendment language sits in the first operative section. 8,000 keeps
// it clear of TopBuild's "shall be amended and restated in its entirety" at
// offset 13,118, which is about a charter.
const OPERATIVE_WINDOW = 8000;

// A complete agreement satisfies any one of these. Generous on purpose: an
// original that fails all three is unusual enough to deserve a human.
const COMPLETE_ARTICLE_COUNT = 3;
const COMPLETE_LENGTH = 60000;
const COMPLETE_SECTION_COUNT = 20;

const AGREEMENT_NAME = String.raw`(?:agreement\s+and\s+plan\s+of\s+(?:merger|reorganization|merger\s+and\s+reorganization)|merger\s+agreement|transaction\s+agreement|business\s+combination\s+agreement|acquisition\s+agreement)`;

// "AMENDED AND RESTATED AGREEMENT AND PLAN OF MERGER", with nothing between the
// two halves. An ordinal prefix ("SECOND AMENDED AND RESTATED ...") still
// matches because it sits before the phrase, not inside it.
const RESTATEMENT_RE = new RegExp(String.raw`amended\s+(?:and|&)\s+restated\s+${AGREEMENT_NAME}`, 'i');

const AMENDMENT_NAME_RES = [
  // "Amendment No. 1 to Agreement and Plan of Merger" (the real Metsera title).
  new RegExp(String.raw`\bamendment\s+(?:no\.?|number|#)\s*\d+`, 'i'),
  // "First Amendment to the Merger Agreement".
  new RegExp(String.raw`\b(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\s+amendment\b`, 'i'),
  // "Amendment to the Amended and Restated Agreement and Plan of Merger".
  new RegExp(String.raw`\bamendment\s+to\s+(?:the\s+|that\s+certain\s+)?(?:[a-z]+\s+)?(?:amended\s+(?:and|&)\s+restated\s+)?${AGREEMENT_NAME}`, 'i'),
  // The document naming itself: (this "Amendment"). Quotes are already
  // straightened by normaliseSource.
  new RegExp(String.raw`\(\s*["']?\s*this\s+amendment\s*["']?\s*\)`, 'i'),
];

// Verbs that only appear in a document whose job is to change another one.
// Absent from every pinned original at every offset.
const OPERATIVE_AMENDMENT_RES = [
  { key: 'is_hereby_amended', re: /\b(?:is|are)\s+hereby\s+amended\b/i },
  { key: 'hereby_amended_and_restated', re: /\bhereby\s+amended\s+(?:and|&)\s+restated\b/i },
  { key: 'amended_to_read_as_follows', re: /\bamended\s+(?:and\s+restated\s+)?(?:in\s+its\s+entirety\s+)?to\s+read\s+as\s+follows\b/i },
  { key: 'hereby_struck', re: /\b(?:is|are)\s+hereby\s+(?:deleted|replaced|inserted|added)\b/i },
  { key: 'deleted_in_its_entirety', re: /\b(?:shall\s+be|is|are)\s+(?:deleted|replaced)\s+in\s+(?:its|their)\s+entirety\b/i },
];

const ARTICLE_RE = /\bARTICLE\s+([IVXLC]{1,7}|\d{1,2})\b/gi;
const SECTION_RE = /\bSECTION\s+(\d{1,2}\.\d{1,2})\b/gi;
const TABLE_OF_CONTENTS_RE = /table\s+of\s+contents/i;

function normaliseSource(value) {
  return String(value == null ? '' : value)
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

// Everything the filing index tells us about an exhibit, as one string. Matches
// the haystack exhibitScore already builds, so the two read the same evidence.
function exhibitTitleText(row) {
  if (row == null) return '';
  if (typeof row === 'string') return row;
  return [row.type, row.description, row.document].map((part) => String(part || '')).join(' ').trim();
}

function firstMatch(value, regexes) {
  let best = null;
  for (const re of regexes) {
    const match = value.match(re);
    if (match && (best === null || match.index < best.index)) best = match;
  }
  return best;
}

// What one string (a title, or the document's caption) says it is.
function nameSignals(source) {
  const value = normaliseSource(source);
  if (!value) {
    return { present: false, restatement: false, amendment: false, nested: false, restatement_text: null, amendment_text: null };
  }
  const restatement = value.match(RESTATEMENT_RE);
  const amendment = firstMatch(value, AMENDMENT_NAME_RES);
  return {
    present: true,
    restatement: Boolean(restatement),
    amendment: Boolean(amendment),
    // "Amendment No. 1 to the Amended and Restated Agreement and Plan of
    // Merger" names both, but the amendment is the document and the
    // restatement is only its subject. Order settles it.
    nested: Boolean(restatement && amendment && amendment.index < restatement.index),
    restatement_text: restatement ? restatement[0] : null,
    amendment_text: amendment ? amendment[0] : null,
  };
}

function operativeSignals(text) {
  const window = normaliseSource(String(text || '').slice(0, OPERATIVE_WINDOW));
  const found = OPERATIVE_AMENDMENT_RES.filter(({ re }) => re.test(window)).map(({ key }) => key);
  return { present: found.length > 0, matches: found };
}

function structureSignals(text) {
  const value = String(text || '');
  const articles = new Set();
  for (const match of value.matchAll(ARTICLE_RE)) articles.add(match[1].toUpperCase());
  const sections = new Set();
  for (const match of value.matchAll(SECTION_RE)) sections.add(match[1]);
  return {
    length: value.length,
    article_count: articles.size,
    section_count: sections.size,
    has_table_of_contents: TABLE_OF_CONTENTS_RE.test(value.slice(0, CAPTION_WINDOW * 4)),
  };
}

// The shape of a document that stands on its own, rather than one that edits
// another. Any single limb is enough.
function looksComplete(structure) {
  return structure.article_count >= COMPLETE_ARTICLE_COUNT
    || structure.length >= COMPLETE_LENGTH
    || (structure.has_table_of_contents && structure.section_count >= COMPLETE_SECTION_COUNT);
}

function saysRestatementOnly(names) {
  return names.restatement && !names.amendment;
}

function saysAmendmentOnly(names) {
  return names.amendment && !names.restatement;
}

function result(revision, reason, signals) {
  return Object.freeze({
    revision,
    // Only these two are a merger agreement we can read end to end.
    is_agreement_document: revision === REVISION.ORIGINAL || revision === REVISION.AMENDED_AND_RESTATED,
    supersedes_earlier_agreement: revision === REVISION.AMENDED_AND_RESTATED,
    needs_human_review: revision === REVISION.AMENDMENT || revision === REVISION.AMBIGUOUS,
    // True when the verdict rests on the title alone; the document text has not
    // confirmed it yet.
    needs_text_confirmation: signals.text_examined === false,
    reason,
    signals: Object.freeze(signals),
  });
}

/**
 * Classify one exhibit.
 *
 * @param {object} input
 * @param {string} [input.title] Filing-index descriptor (type, description, filename).
 * @param {string} [input.text]  Normalised document text, when it has been fetched.
 * @returns {object} Frozen verdict: revision, is_agreement_document,
 *   needs_human_review, needs_text_confirmation, reason, signals.
 */
function classifyAgreementRevision({ title = '', text = '' } = {}) {
  const titleNames = nameSignals(title);
  const documentText = String(text || '');
  const textExamined = documentText.trim().length > 0;
  const captionNames = nameSignals(documentText.slice(0, CAPTION_WINDOW));
  const operative = textExamined ? operativeSignals(documentText) : { present: false, matches: [] };
  const structure = textExamined ? structureSignals(documentText) : null;
  const complete = textExamined ? looksComplete(structure) : false;

  const signals = {
    text_examined: textExamined,
    title: titleNames,
    caption: captionNames,
    operative_amendment_language: operative,
    structure,
    looks_like_complete_document: complete,
  };

  const namedRestatement = titleNames.restatement || captionNames.restatement;
  const namedAmendment = titleNames.amendment || captionNames.amendment;
  const nested = titleNames.nested || captionNames.nested;
  // One source calls it a restatement and the other calls it an amendment.
  const namingConflict = (saysRestatementOnly(titleNames) && saysAmendmentOnly(captionNames))
    || (saysRestatementOnly(captionNames) && saysAmendmentOnly(titleNames));

  if (namedRestatement && namedAmendment) {
    if (namingConflict) {
      return result(
        REVISION.AMBIGUOUS,
        `Title and document caption disagree: one names an amendment (${titleNames.amendment_text || captionNames.amendment_text}) and the other names a restatement (${titleNames.restatement_text || captionNames.restatement_text}).`,
        signals,
      );
    }
    if (nested) {
      const label = titleNames.amendment_text || captionNames.amendment_text;
      if (textExamined && complete && !operative.present) {
        return result(
          REVISION.AMBIGUOUS,
          `Named as an amendment to a restated agreement ("${label}") but the document has the structure of a complete agreement.`,
          signals,
        );
      }
      return result(
        REVISION.AMENDMENT,
        `Amendment to an amended and restated agreement ("${label}"). It modifies an agreement filed elsewhere.`,
        signals,
      );
    }
    return result(
      REVISION.AMBIGUOUS,
      'The document names both a restatement and an amendment, and the order does not settle which one it is.',
      signals,
    );
  }

  if (namedAmendment) {
    const label = titleNames.amendment_text || captionNames.amendment_text;
    if (textExamined && complete && !operative.present) {
      return result(
        REVISION.AMBIGUOUS,
        `Named as an amendment ("${label}") but the document has the structure of a complete agreement (${structure.article_count} articles, ${structure.length} characters).`,
        signals,
      );
    }
    return result(
      REVISION.AMENDMENT,
      `Amendment ("${label}"), not a standalone merger agreement. It modifies an agreement filed elsewhere.`,
      signals,
    );
  }

  if (namedRestatement) {
    const label = titleNames.restatement_text || captionNames.restatement_text;
    if (!textExamined) {
      return result(
        REVISION.AMENDED_AND_RESTATED,
        `Amended and restated agreement ("${label}") by title. It supersedes an earlier agreement.`,
        signals,
      );
    }
    if (operative.present) {
      return result(
        REVISION.AMBIGUOUS,
        `Named as an amended and restated agreement ("${label}") but the text uses amendment operative language (${operative.matches.join(', ')}).`,
        signals,
      );
    }
    if (!complete) {
      return result(
        REVISION.AMBIGUOUS,
        `Named as an amended and restated agreement ("${label}") but the document lacks the structure of a complete agreement (${structure.article_count} articles, ${structure.length} characters).`,
        signals,
      );
    }
    return result(
      REVISION.AMENDED_AND_RESTATED,
      `Amended and restated agreement ("${label}"). It is complete in itself and supersedes an earlier agreement.`,
      signals,
    );
  }

  if (!textExamined) {
    // The title says nothing either way. Not a failure: most real exhibit
    // descriptors are as bare as "EX-2.1". The text decides.
    return result(
      REVISION.UNKNOWN,
      'The exhibit title does not say whether this is an original agreement, a restatement or an amendment.',
      signals,
    );
  }

  if (operative.present) {
    if (complete) {
      return result(
        REVISION.AMBIGUOUS,
        `The document has the structure of a complete agreement but uses amendment operative language (${operative.matches.join(', ')}).`,
        signals,
      );
    }
    return result(
      REVISION.AMENDMENT,
      `Untitled amendment: no article structure and amendment operative language (${operative.matches.join(', ')}).`,
      signals,
    );
  }

  // Nothing names it a restatement or an amendment, and it uses none of the
  // language a document needs in order to change another one. That is positive
  // evidence for an original, so it is not held back on shape alone: a document
  // too short or too thin to be an agreement is a different question, already
  // answered by the caller's minimum-length gate. Widening ambiguity to cover
  // it would send ordinary filings to a human for no revision-related reason.
  return result(
    REVISION.ORIGINAL,
    complete
      ? 'Original agreement: complete document, no restatement or amendment naming and no amendment operative language.'
      : 'Original agreement: no restatement or amendment naming and no amendment operative language.',
    signals,
  );
}

module.exports = {
  AGREEMENT_REVISION: REVISION,
  CAPTION_WINDOW,
  COMPLETE_ARTICLE_COUNT,
  COMPLETE_LENGTH,
  COMPLETE_SECTION_COUNT,
  OPERATIVE_WINDOW,
  classifyAgreementRevision,
  exhibitTitleText,
};
