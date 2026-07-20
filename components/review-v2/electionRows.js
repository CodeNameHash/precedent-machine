// r17 (Ben): "the oversubscription rows look generic … it also lacks see
// provision — same as the deadline etc. — can we add that and make them look
// more like normal table rows?"
//
// Data-only row builder for review-v2/ElectionCard's election-mechanics
// block. Plain JS (no JSX) so node --test can pin the derived summaries and
// the seeTextContent contract directly; ElectionCard.jsx renders these rows
// through the shared GroupedSubRows primitive (the same left-column
// "See provision" toggle + full-width expansion every other grouped table
// uses).
//
// Legal-correctness rules (r17):
//  - a derived sentence appears ONLY when the clause shape is confidently
//    detected (summarizeOversubscription / summarizeElectionDeadline return
//    null otherwise) -- the row then carries the verbatim clause behind
//    See provision with NO derived line, never a generic sentence that
//    reads as if it were extracted;
//  - a "deadline" that is just a defined-term echo ("Election Deadline",
//    the Skechers CONSID-CONVERT mechanics object's value) is dropped
//    entirely -- there is nothing behind it worth a row.

import {
  summarizeElectionDeadline,
  summarizeOversubscription,
} from '../review/table-configs/consideration-hero.config.js';

// A deadline string is informative when it carries an actual timing fact
// (a digit or a spelled-out day count), not just the defined term's name.
export function isInformativeDeadline(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  if (/\d/.test(t)) return true;
  return /\b(one|two|three|four|five|six|seven|eight|nine|ten)\b[\s\S]{0,30}?\bdays?\b/i.test(t);
}

// Cross-card mechanics merge (used by sectionList.deriveElectionSummary):
// the election deadline and the oversubscription clause routinely live on
// DIFFERENT cards' prorationMechanics objects (Skechers: the picked
// CONSID-CONVERT card's deadline is the bare term "Election Deadline" and
// its oversubscriptionTreatment is null; the real values sit on the
// CONSID-EXCHANGE card's §2.9 mechanics). Callers pass the picked card's
// mechanics FIRST so it wins whenever it is itself informative.
export function pickElectionDeadline(pmList) {
  const list = (pmList || []).filter(Boolean);
  const values = list.map((pm) => pm.electionDeadline).filter(Boolean).map(String);
  return values.find(isInformativeDeadline) || values[0] || null;
}
export function pickOversubscription(pmList) {
  const list = (pmList || []).filter(Boolean);
  for (const pm of list) {
    if (pm.oversubscriptionTreatment) return String(pm.oversubscriptionTreatment);
  }
  return null;
}

// GroupedSubRows-shaped rows: { id, label, value, seeTextContent, evidence,
// card }. `value` is the derived sentence (null when no confident shape --
// ElectionCard renders a muted pointer instead, never a fabricated line);
// `seeTextContent` is the verbatim clause for the full-width expansion;
// `caps` (caps row only) carries {label, figure} pairs for pill rendering.
export function buildElectionMechanicsRows(election) {
  if (!election || election.noElection) return [];
  const rows = [];
  const card = election.sourceCard || null;

  if (Array.isArray(election.caps) && election.caps.length) {
    const note = election.prorationNote ? String(election.prorationNote) : null;
    rows.push({
      id: 'election-caps',
      label: 'Election caps',
      caps: election.caps,
      value: election.caps.map((cap) => `${cap.label}: ${cap.figure}`).join(' · '),
      seeTextContent: note,
      evidence: note || election.evidence || null,
      card,
    });
  }

  const deadlineRaw = election.electionDeadline ? String(election.electionDeadline) : '';
  if (deadlineRaw && isInformativeDeadline(deadlineRaw)) {
    rows.push({
      id: 'election-deadline',
      label: 'Election deadline',
      value: summarizeElectionDeadline(deadlineRaw),
      seeTextContent: deadlineRaw,
      evidence: deadlineRaw,
      card,
    });
  }

  const oversRaw = election.oversubscriptionTreatment ? String(election.oversubscriptionTreatment) : '';
  if (oversRaw) {
    rows.push({
      id: 'election-oversubscription',
      label: 'Oversubscription / proration',
      value: summarizeOversubscription(oversRaw),
      seeTextContent: oversRaw,
      evidence: oversRaw,
      card,
    });
  } else if (election.isProrated && election.prorationNote) {
    // Prorated deal whose deck carries no oversubscription clause at all:
    // the row still exists (proration is a fact of the deal) but shows only
    // the verbatim mechanics text behind See provision -- no derived
    // sentence, because there is no clause shape to derive one from.
    rows.push({
      id: 'election-proration',
      label: 'Proration',
      value: null,
      seeTextContent: String(election.prorationNote),
      evidence: String(election.prorationNote),
      card,
    });
  }

  if (election.defaultTreatment) {
    rows.push({
      id: 'election-default',
      label: 'If no election',
      value: `Treated as ${election.defaultTreatment}`,
      seeTextContent: null,
      evidence: election.evidence || null,
      card,
    });
  }

  return rows;
}
