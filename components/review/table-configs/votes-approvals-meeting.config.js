import React from 'react';
import { approvalsVotesConfig } from './approvals-votes.config.js';
import { secMeetingConfig } from './sec-meeting.config.js';
import { enumLabel } from '../../../lib/sec-meeting.js';
import { cardCode, cardFeatures, textOf, valueText } from './card-utils.js';
import { TERM_COL_WIDTH, TERM_COL_MAX } from './layout.js';
import { voteStandard } from './vote-standard.js';

// Rebuild target: REBUILD-SPECS.md section 9 ("Ben: really good" in the old
// site). The old deadline-pill pattern is number + [unit pill] + "after" +
// [reference pill] -- e.g. "Meeting: 30 [calendar days] after [mailing]" --
// not a flattened prose sentence. Reuses approvalsVotesConfig /
// secMeetingConfig's row-building UNCHANGED (both configs keep their own
// exports + tests, including the underlying deadline/adjournment prose
// parsing added to lib/sec-meeting.js for this rebuild); this module picks
// specific rows out of their output by id and re-renders them as the curated
// TERM | PROVISION list REBUILD-SPECS.md #9 calls for, dropping the
// generic/duplicate rows (quorum, record date, company/parent approval
// method, vote-failure termination, the old raw "meeting" text dump) that
// the pre-rebuild wrapper surfaced indiscriminately.

// Synthesizes the actual stockholder-vote standard from a definition/
// threshold sentence, so the pill reads "Majority of outstanding shares"
// (the thing that matters) instead of the full defined-term prose. The
// synthesizer now lives in ./vote-standard.js — one shared definition across
// conditions, votes-approvals-meeting, and termination-rights.

function byId(rows, id) {
  return (rows || []).find((row) => row.id === id) || null;
}

// number + [unit pill] + "after" + [reference pill]. Falls back to the
// existing TruncatedWithSeeText "see text" affordance (never a raw prose
// dump) when the underlying deadline has no parseable count -- genuinely
// unparseable prose, not the common case now that lib/sec-meeting.js parses
// verbatim deadline sentences.
function deadlinePillNode(deadline, ctx, evidence, source) {
  const PillCell = ctx?.primitives?.PillCell;
  const TruncatedWithSeeText = ctx?.primitives?.TruncatedWithSeeText;
  if (!deadline) return null;
  if (typeof deadline.days === 'number' && deadline.unit) {
    const nodes = [
      React.createElement('span', { key: 'n', className: 'text-[12px] font-semibold text-ink' }, String(deadline.days)),
    ];
    if (PillCell) {
      nodes.push(React.createElement(PillCell, {
        key: 'unit', label: enumLabel(deadline.unit), tone: 'neutral', evidence: deadline.text || evidence, source,
      }));
    }
    if (deadline.trigger) {
      nodes.push(React.createElement('span', { key: 'after', className: 'text-[11px] text-inkFaint' }, 'after'));
      if (PillCell) {
        nodes.push(React.createElement(PillCell, {
          key: 'ref', label: enumLabel(deadline.trigger), tone: 'info', evidence: deadline.text || evidence, source,
        }));
      }
    }
    return React.createElement('div', { className: 'flex flex-wrap items-center gap-1' }, nodes);
  }
  if (!deadline.text) return null;
  return TruncatedWithSeeText
    ? React.createElement(TruncatedWithSeeText, { text: deadline.text, evidence: evidence || deadline.text, source })
    : deadline.text;
}

// FEEDBACK-2-PUNCHLIST.md #11: flat sibling pills read as one undifferentiated
// list -- "[Insufficient votes][Company][15 days total]" doesn't say which
// pill is the REASON, which is WHO controls the right, and which is the
// LIMIT. Restructured into the same labelled-group pattern
// conditions.config.js's rep bring-down uses (bringDownNode there): an
// uppercase sub-heading naming what the pill(s) below it are, so this reads
// as three named parts -- Permitted reason / Controlling party /
// Restriction -- not three interchangeable tags.
function consentPartyFromText(text) {
  const match = /without\s+(?:the\s+)?(?:prior\s+)?(?:written\s+)?consent\s+of\s+(?:the\s+)?(Parent|Company)/i.exec(String(text || ''));
  return match ? match[1] : null;
}

// "No more than N days[/each/adjournments]" -- optionally suffixed with
// "without <Party>'s consent" ONLY when the underlying verbatim text
// actually says so (consentPartyFromText), never fabricated for deals whose
// adjournment right isn't consent-gated.
function restrictionLabels(right) {
  if (!right) return [];
  const parts = [];
  if (typeof right.maxDaysTotal === 'number') parts.push(`No more than ${right.maxDaysTotal} days`);
  if (typeof right.maxDaysPerAdjournment === 'number') parts.push(`No more than ${right.maxDaysPerAdjournment} days each`);
  if (typeof right.maxAdjournments === 'number') {
    parts.push(`No more than ${right.maxAdjournments} adjournment${right.maxAdjournments === 1 ? '' : 's'}`);
  }
  if (!parts.length) return [];
  const consentParty = consentPartyFromText(right.text);
  return consentParty ? parts.map((part) => `${part} without ${consentParty}'s consent`) : parts;
}

function adjournmentGroupedNode(right, ctx, evidence, source) {
  const PillCell = ctx?.primitives?.PillCell;
  const TruncatedWithSeeText = ctx?.primitives?.TruncatedWithSeeText;
  if (!right) return null;
  const reasonLabels = (right.reasons || [])
    .map((reason) => reason?.label || (reason?.code ? enumLabel(reason.code) : null))
    .filter(Boolean);
  const partyLabel = right.party ? enumLabel(right.party) : null;
  const groups = [
    reasonLabels.length ? { key: 'reason', heading: 'Permitted reason', tone: 'warning', labels: reasonLabels } : null,
    partyLabel ? { key: 'party', heading: 'Controlling party', tone: 'neutral', labels: [partyLabel] } : null,
    restrictionLabels(right).length ? { key: 'restriction', heading: 'Restriction', tone: 'info', labels: restrictionLabels(right) } : null,
  ].filter(Boolean);
  if (!groups.length) {
    if (!right.text) return null;
    return TruncatedWithSeeText
      ? React.createElement(TruncatedWithSeeText, { text: right.text, evidence: evidence || right.text, source })
      : right.text;
  }
  if (!PillCell) {
    return React.createElement(
      'div',
      { className: 'space-y-1' },
      groups.map((group) => React.createElement('div', { key: group.key }, `${group.heading}: ${group.labels.join(', ')}`)),
    );
  }
  return React.createElement(
    'div',
    { className: 'space-y-2' },
    groups.map((group) => React.createElement(
      'div',
      { key: group.key, className: 'space-y-1' },
      React.createElement('div', { className: 'text-[11px] font-semibold uppercase tracking-wide text-inkFaint' }, group.heading),
      React.createElement(
        'div',
        { className: 'flex flex-wrap gap-1' },
        group.labels.map((label, index) => React.createElement(PillCell, {
          key: index, label, tone: group.tone, evidence: right.text || evidence, source,
        })),
      ),
    )),
  );
}

// FEEDBACK-2-PUNCHLIST.md #13: Parent / Merger Sub's own approval of the
// merger agreement (COV-SHAPRV-PARENT -- Parent, as sole stockholder of
// Merger Sub, adopting by written consent or board resolution) belongs
// here, moved from General Covenants (see general-covenants.config.js's
// VOTES_OWNED_CODES exclusion). Rendered from the actual
// parentAdoptionMechanism/parentAdoptionTiming features, NOT as "written
// consent required" -- that phrasing describes the COMPANY-side approval
// row above and would wrongly imply the Company also needs written
// consent. This is Parent/Merger Sub's OWN mechanism, distinct from (and
// not conditioned on) the Company stockholder vote.
const PARENT_ADOPTION_MECHANISM_TEXT = {
  WRITTEN_CONSENT: "in writing by Parent; no separate Parent vote required",
  SOLE_STOCKHOLDER_ADOPTION: "by Parent, as sole stockholder of Merger Sub; no separate Parent vote required",
  BOARD_ONLY: 'by Parent board resolution only; no Parent stockholder approval required',
};

function findParentApprovalCard(reviewDeal) {
  const cards = reviewDeal?.cards || [];
  return cards.find((card) => cardCode(card) === 'COV-SHAPRV-PARENT') || null;
}

function parentApprovalText(card) {
  const features = cardFeatures(card);
  const mechanismRaw = features.parentAdoptionMechanism;
  const mechanismCode = String(mechanismRaw?.code || mechanismRaw?.value || mechanismRaw || '').toUpperCase();
  const mechanismText = PARENT_ADOPTION_MECHANISM_TEXT[mechanismCode] || null;
  const timing = valueText(features.parentAdoptionTiming);
  if (mechanismText) return timing ? `${mechanismText} (${timing})` : mechanismText;
  // Ben (Mergertrace round 1): no structured mechanism claim on the card
  // (Metsera) left this row dumping raw clause prose while every sibling
  // renders a pill. Derive the standard sole-stockholder-adoption mechanism
  // deterministically from the clause's own unambiguous wording; anything
  // that doesn't match stays on the see-text fallback rather than guessing.
  const clause = textOf(card);
  if (/as\s+(?:the\s+)?sole\s+stockholder\s+of\s+(?:the\s+)?merger\s+sub/i.test(clause)
    && /\b(?:adopt|approv)/i.test(clause)) {
    const immediate = /immediately\s+(?:following|after)\s+(?:the\s+)?execution/i.test(clause);
    return immediate
      ? 'Parent adopts as sole stockholder of Merger Sub (immediately after signing)'
      : 'Parent adopts as sole stockholder of Merger Sub';
  }
  // (Item 7, QXO) "sole stockholder" phrasing doesn't cover the
  // written-consent-by-all-record-holders mechanic QXO's §4.15 uses --
  // Parent causing a written consent to be executed by ALL record holders
  // of Merger Sub's stock, rather than acting as sole stockholder itself.
  if (/cause\s+a\s+written\s+consent\s+to\s+be\s+executed\s+by\s+all\s+of\s+the\s+(?:record\s+)?(?:holders|stockholders)\b[\s\S]{0,120}?\bMerger\s+Sub\b/i.test(clause)
    && /\b(?:adopt|approv)/i.test(clause)) {
    const immediate = /immediately\s+(?:following|after)\s+(?:the\s+)?execution/i.test(clause);
    return immediate
      ? 'Merger Sub stockholders adopt by written consent (immediately after signing)'
      : 'Merger Sub stockholders adopt by written consent';
  }
  return null;
}

function parentApprovalNode(card, ctx) {
  const PillCell = ctx?.primitives?.PillCell;
  const TruncatedWithSeeText = ctx?.primitives?.TruncatedWithSeeText;
  if (!card) return null;
  const evidence = textOf(card);
  const text = parentApprovalText(card);
  if (text) {
    return PillCell
      ? React.createElement(PillCell, { label: text, tone: 'neutral', evidence, source: card })
      : text;
  }
  // No resolvable mechanism code -- fall back to whatever prose the card
  // does carry rather than fabricating the written-consent wording, matching
  // this file's existing "never inline a raw sentence without the see-text
  // escape hatch" convention. The real clause (evidence = textOf(card)) is
  // preferred over mainConcept -- mainConcept is documented (lib/schema/
  // features.js) as an AI paraphrase "used ... when no more specific
  // structured field explains the provision", and the "see text" escape
  // hatch must always show the actual provision text, not a summary of it.
  const fallback = evidence || valueText(cardFeatures(card).mainConcept);
  if (!fallback) return null;
  return TruncatedWithSeeText
    ? React.createElement(TruncatedWithSeeText, { text: fallback, evidence, source: card })
    : fallback;
}

// Approval-definition / vote-threshold: synthesized vote-standard pill when
// the text resolves to one, else "see text" (never the raw defined-term
// sentence inline).
function voteStandardNode(text, fallbackText, ctx, evidence, source) {
  const TruncatedWithSeeText = ctx?.primitives?.TruncatedWithSeeText;
  const PillCell = ctx?.primitives?.PillCell;
  const std = voteStandard(text) || (fallbackText ? voteStandard(fallbackText) : null);
  const raw = text || fallbackText;
  if (std) {
    return PillCell
      ? React.createElement(PillCell, { label: std, tone: 'present', evidence: raw || evidence, source })
      : std;
  }
  if (!raw) return null;
  return TruncatedWithSeeText
    ? React.createElement(TruncatedWithSeeText, { text: raw, evidence: evidence || raw, source })
    : raw;
}

function boolPillNode(text, ctx, evidence, source) {
  const PillCell = ctx?.primitives?.PillCell;
  if (!text) return null;
  return PillCell
    ? React.createElement(PillCell, { label: text, tone: text === 'Yes' ? 'present' : 'neutral', evidence, source })
    : text;
}

// Curated row list: Approval definition, Written consent, Vote threshold,
// Parent / Merger Sub approvals, Proxy filing deadline, Mailing, Meeting,
// Adjournment rights (one row per party/reason combination). Each row
// carries enough of the underlying data (not just a pre-rendered node) for
// the 'provision' column's renderCell to build the right pill shape per
// `kind`. FEEDBACK-2-PUNCHLIST.md #12: the old "Meeting control notes" row
// (sec-meeting's meetingControlNotes) added nothing distinguishable from
// the deadline rows above it and has been dropped entirely.
function buildRows(reviewDeal) {
  const approvalRows = approvalsVotesConfig.selectRows(reviewDeal) || [];
  const meetingRows = secMeetingConfig.selectRows(reviewDeal) || [];

  const approvalDefRow = byId(approvalRows, 'approvals-votes-approval-definition');
  const consentRow = byId(approvalRows, 'approvals-votes-written-consent-required');
  const voteThresholdRow = byId(approvalRows, 'approvals-votes-vote-threshold');
  const proxyRow = byId(meetingRows, 'sec-meeting-proxy-filing');
  const mailingRow = byId(meetingRows, 'sec-meeting-mailing');
  const meetingRow = byId(meetingRows, 'sec-meeting-meeting');
  const adjournmentRowList = meetingRows.filter((row) => row.id.startsWith('sec-meeting-adjournment-'));
  const parentApprovalCard = findParentApprovalCard(reviewDeal);

  const rows = [];
  // Ben (round 6): make Company vs Parent approvals explicit, and drop the
  // "Written consent required" row (redundant with the Parent approval row --
  // Parent adopts by written consent as sole stockholder of Merger Sub).
  if (approvalDefRow) {
    rows.push({
      id: 'votes-approvals-meeting-approval-definition', label: 'Company stockholder approval', kind: 'vote-standard',
      text: approvalDefRow.detail, evidence: approvalDefRow.evidence, source: approvalDefRow.source,
    });
  }
  if (voteThresholdRow) {
    // Ben (Mergertrace round 1): "Vote threshold" duplicated the standard
    // already shown on the Company-stockholder-approval row whenever the
    // threshold claim resolves to the SAME vote standard (or resolves to
    // nothing and falls back to the approval row's text — Metsera). Only a
    // threshold that GENUINELY differs earns its own row, labelled with the
    // party so it reads unambiguously as the Company's vote.
    const thresholdStd = voteStandard(voteThresholdRow.detail);
    const approvalStd = voteStandard(approvalDefRow?.detail);
    if (thresholdStd && thresholdStd !== approvalStd) {
      rows.push({
        id: 'votes-approvals-meeting-vote-threshold', label: 'Company vote threshold', kind: 'vote-standard',
        text: voteThresholdRow.detail, evidence: voteThresholdRow.evidence, source: voteThresholdRow.source,
      });
    }
  }
  if (parentApprovalCard) {
    rows.push({
      id: 'votes-approvals-meeting-parent-approval', label: 'Parent / Merger Sub approvals', kind: 'parent-approval',
      card: parentApprovalCard,
    });
  } else {
    // Explicit "Not specified" rather than silently omitting the Parent side.
    rows.push({
      id: 'votes-approvals-meeting-parent-approval', label: 'Parent / Merger Sub approvals', kind: 'vote-standard',
      text: 'Not specified',
    });
  }
  if (proxyRow) {
    rows.push({
      id: 'votes-approvals-meeting-proxy-filing', label: proxyRow.label, kind: 'deadline',
      deadline: proxyRow.deadline, evidence: proxyRow.evidence, source: proxyRow.sourceCard,
    });
  }
  if (mailingRow) {
    rows.push({
      id: 'votes-approvals-meeting-mailing', label: 'Mailing', kind: 'deadline',
      deadline: mailingRow.deadline, evidence: mailingRow.evidence, source: mailingRow.sourceCard,
    });
  }
  if (meetingRow) {
    rows.push({
      id: 'votes-approvals-meeting-meeting', label: 'Meeting', kind: 'deadline',
      deadline: meetingRow.deadline, evidence: meetingRow.evidence, source: meetingRow.sourceCard,
    });
  }
  adjournmentRowList.forEach((row, index) => {
    rows.push({
      id: `votes-approvals-meeting-adjournment-${index}`, label: 'Adjournment rights', kind: 'adjournment',
      adjournment: row.adjournment, evidence: row.evidence, source: row.sourceCard,
    });
  });
  return rows;
}

function renderProvisionCell(row, ctx) {
  switch (row.kind) {
    case 'bool': return boolPillNode(row.text, ctx, row.evidence, row.source);
    case 'vote-standard': return voteStandardNode(row.text, row.fallbackText, ctx, row.evidence, row.source);
    case 'deadline': return deadlinePillNode(row.deadline, ctx, row.evidence, row.source);
    case 'adjournment': return adjournmentGroupedNode(row.adjournment, ctx, row.evidence, row.source);
    case 'parent-approval': return parentApprovalNode(row.card, ctx);
    default: return row.text || null;
  }
}

const votesApprovalsMeetingConfig = {
  id: 'votes-approvals-meeting',
  title: 'Votes / Approvals / SEC Filing / Meeting Requirements',
  layoutSlot: 'conditions',
  selectRows(reviewDeal) {
    return buildRows(reviewDeal);
  },
  fixedLayout: true,
  columns: [
    { id: 'term', header: 'Term', width: TERM_COL_WIDTH, maxWidth: TERM_COL_MAX, renderCell: (row) => row.label },
    { id: 'provision', header: 'Provision', renderCell: renderProvisionCell },
  ],
};

export { buildRows, votesApprovalsMeetingConfig };
