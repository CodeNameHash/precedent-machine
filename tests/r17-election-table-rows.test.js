// Ben feedback r17 (election/oversubscription rows, Consideration section):
//  "The oversubscription rows look generic (check they are technically
//   correct — there are different types of proration) and it also lacks
//   see provision — same as the deadline etc. — can we add that and make
//   them look more like normal table rows?"
//
// Pins, per distinct clause shape found in the cached corpus:
//  - QXO/TopBuild: two-sided by-share caps (45% cash / 55% stock of
//    outstanding shares), symmetric pro-rata cut-back with balance in the
//    other form, non-electing shares DEEMED Stock Elections (so they share
//    stock-side proration);
//  - 3G/Skechers: one-sided Maximum Equity Election Cap, per-holder
//    pro-rata cut-back of mixed elections with the remainder converted to
//    the cash election consideration, non-election defaults to cash; the
//    deadline/oversubscription clauses live on a DIFFERENT card than the
//    picked election card (cross-card merge);
//  - no-confident-shape fallback: NO derived sentence, verbatim clause
//    behind See provision (never a generic line that reads as extracted);
//  - seeTextContent presence on the deadline + oversubscription rows (the
//    GroupedSubRows full-width expansion contract).
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

let heroMod;
let rowsMod;
test.before(async () => {
  heroMod = await import(path.join('..', 'components', 'review', 'table-configs', 'consideration-hero.config.js'));
  rowsMod = await import(path.join('..', 'components', 'review-v2', 'electionRows.js'));
});

// Verbatim clause fixtures (from the cached corpus decks).
const QXO_DEADLINE = '5:00 P.M. (Eastern Time) on the business day that is five (5) business days prior to the date of the Company Stockholder Meeting or such other date and time as Parent may publicly announce with the consent of the Company';
const SKX_DEADLINE = '5:00 p.m. (Eastern Time) on the date that is five Business Days preceding the anticipated Closing Date';
const QXO_OVERSUB = 'In the event that the aggregate number of Cash Election Shares exceeds the Maximum Cash Election Number, all Stock Election Shares shall be converted into the right to receive Stock Consideration, and all Cash Election Shares shall be converted into the right to receive: ... In the event that the aggregate number of Stock Election Shares exceeds the Maximum Stock Election Number, all Cash Election Shares shall be converted into the right to receive Cash Consideration, and all Stock Election Shares shall be converted into the right to receive:';
const SKX_OVERSUB = 'If the aggregate number of Mixed Election Shares exceeds the Maximum Equity Election Cap, then:\n\n (i) all Mixed Election Shares of each holder thereof will be converted into the right to receive the Mixed Election Consideration in respect of that number of Mixed Election Shares equal to the product obtained by multiplying (A) the number of Mixed Election Shares held by such holder by (B) a fraction, the numerator of which is the Maximum Equity Election Cap and the denominator of which is the aggregate number of Mixed Election Shares (prior to the conversion contemplated by this Section 2.9(a)(i)), with the remaining number of such holder’s Mixed Election Shares being converted into the right to receive the Cash Election Consideration (as Cash Election Shares);';
const QXO_ALLOCATION = 'the maximum number of Company Shares to be converted into the right to receive Cash Consideration in the Titanium Merger shall be equal to forty-five percent (45%) of the aggregate number of Company Shares issued and outstanding (other than Cancelled Shares) as of immediately prior to the Titanium Merger Effective Time (the "Maximum Cash Election Number") and the maximum number of Company Shares to be converted into the right to receive Stock Consideration in the Titanium Merger shall be equal to fifty-five percent (55%) of the aggregate number of Company Shares issued and outstanding (other than Cancelled Shares) as of immediately prior to the Titanium Merger Effective Time (as may be increased (but not decreased) by Parent in its sole discretion, if and only if holders of Company Shares have elected to receive more than fifty-five percent (55%) of the merger consideration in Parent Shares, upon written notice to the Company at any time prior to the Closing, the "Maximum Stock Election Number").';
const QXO_DEEMED = 'Company Shares in respect of which no Cash Election or Stock Election has been affirmatively made and not revoked shall be deemed to be Company Shares in respect of which Stock Elections have been made (such Company Shares, the "No Election Shares").';

// ── summarizeElectionDeadline: per-deal derived values ─────────────────────

test('deadline: QXO clause -> "5 business days before the Company Stockholder Meeting"', () => {
  assert.equal(heroMod.summarizeElectionDeadline(QXO_DEADLINE), '5 business days before the Company Stockholder Meeting');
});

test('deadline: Skechers clause ("preceding the anticipated Closing Date" shape) -> derived, not the raw dump', () => {
  assert.equal(heroMod.summarizeElectionDeadline(SKX_DEADLINE), '5 business days before the anticipated Closing Date');
});

test('deadline: a bare defined-term echo is NOT summarizable and NOT informative (the old Skechers "Election deadline: Election Deadline" row must never come back)', () => {
  assert.equal(heroMod.summarizeElectionDeadline('Election Deadline'), null);
  assert.equal(rowsMod.isInformativeDeadline('Election Deadline'), false);
  assert.equal(rowsMod.isInformativeDeadline(SKX_DEADLINE), true);
  assert.equal(rowsMod.isInformativeDeadline(QXO_DEADLINE), true);
});

// ── summarizeOversubscription: one sentence per clause shape ───────────────

test('oversubscription: QXO two-sided cap shape -> symmetric cut-back sentence', () => {
  const line = heroMod.summarizeOversubscription(QXO_OVERSUB);
  assert.match(line, /If either side is oversubscribed/);
  assert.match(line, /prorated back to the cap/);
  assert.match(line, /balance paid in the other form/);
});

test('oversubscription: Skechers one-sided equity-cap shape -> per-holder pro-rata with cash remainder', () => {
  const line = heroMod.summarizeOversubscription(SKX_OVERSUB);
  assert.match(line, /mixed \(cash \+ stock\) elections exceed the equity election cap/i);
  assert.match(line, /prorated back to the cap pro rata/);
  assert.match(line, /remainder paid as the cash election consideration/);
});

test('oversubscription: one-sided cash-only cap shape', () => {
  const line = heroMod.summarizeOversubscription('If the aggregate number of Cash Election Shares exceeds the Maximum Cash Election Number, the Cash Election Shares shall be prorated.');
  assert.match(line, /cash elections exceed the cap/i);
  assert.match(line, /stock elections are honored in full/i);
});

test('oversubscription: unrecognized clause shape -> null, never the raw text and never a guess', () => {
  assert.equal(heroMod.summarizeOversubscription('Any shortfall in either form of consideration shall be reallocated among the holders as the Exchange Agent determines equitable.'), null);
  assert.equal(heroMod.summarizeOversubscription(''), null);
});

// ── hero proration row: QXO by-shares caps + deemed-stock default ──────────

test('proration mechanism (QXO): caps named as by-share caps, Parent stock-cap increase flagged, non-electing shares deemed Stock Elections', () => {
  const line = heroMod.summarizeProrationMechanism(
    [{ text: QXO_ALLOCATION, electionType: 'MIXED_ELECTION', oversubscriptionTreatment: QXO_OVERSUB }],
    QXO_DEEMED,
  );
  assert.match(line, /Caps: 45% cash \/ 55% stock of outstanding shares/);
  assert.match(line, /Parent may increase the stock cap/);
  assert.match(line, /deemed Stock Elections/);
  assert.match(line, /prorated with that side if it is oversubscribed/);
});

test('proration mechanism: deemed-default detection never fires without the deemed clause (r16 Skechers output unchanged)', () => {
  const line = heroMod.summarizeProrationMechanism([
    { text: 'each share of Company Common Stock with respect to which a Mixed Election or Cash Election Consideration has not been validly made or has been revoked, deemed revoked or lost before the Election Deadline ("Non-Election Shares") shall be converted automatically into the right to receive the Cash Election Consideration.', electionType: 'MIXED_ELECTION', oversubscriptionTreatment: null },
    { text: 'Each holder may specify the number of shares elected.', electionType: 'MIXED_ELECTION', oversubscriptionTreatment: SKX_OVERSUB },
  ]);
  assert.match(line, /Shares with no valid election receive the Cash Election Consideration/);
  assert.ok(!/deemed/.test(line));
});

// ── cross-card mechanics merge (the Skechers split-card shape) ─────────────

test('pickElectionDeadline / pickOversubscription: informative values win over the picked card\'s defined-term echo / null', () => {
  const convertPm = { text: 'non-election default…', electionDeadline: 'Election Deadline', oversubscriptionTreatment: null };
  const exchangePm = { text: 'election procedures…', electionDeadline: SKX_DEADLINE, oversubscriptionTreatment: SKX_OVERSUB };
  assert.equal(rowsMod.pickElectionDeadline([convertPm, exchangePm]), SKX_DEADLINE);
  assert.equal(rowsMod.pickOversubscription([convertPm, exchangePm]), SKX_OVERSUB);
  // picked card first and informative -> it wins
  assert.equal(rowsMod.pickElectionDeadline([exchangePm, convertPm]), SKX_DEADLINE);
  assert.equal(rowsMod.pickElectionDeadline([convertPm]), 'Election Deadline');
  assert.equal(rowsMod.pickOversubscription([convertPm]), null);
});

// ── ElectionCard mechanics rows: GroupedSubRows / seeTextContent contract ──

function skechersElection() {
  return {
    options: [
      { label: 'Cash Election', economics: '$63.00 / share' },
      { label: 'Mixed Election', economics: '$57.00 cash + 1 Parent Unit' },
    ],
    defaultTreatment: 'Cash Election',
    isProrated: true,
    prorationNote: 'non-election default…',
    caps: [],
    electionDeadline: SKX_DEADLINE,
    oversubscriptionTreatment: SKX_OVERSUB,
    evidence: 'Section 2.7 …',
    sourceCard: { id: 'skx-card' },
  };
}

test('rows (Skechers): deadline + oversubscription rows carry derived value AND the verbatim clause as seeTextContent', () => {
  const rows = rowsMod.buildElectionMechanicsRows(skechersElection());
  const deadline = rows.find((r) => r.id === 'election-deadline');
  const oversub = rows.find((r) => r.id === 'election-oversubscription');
  assert.ok(deadline && oversub);
  assert.equal(deadline.value, '5 business days before the anticipated Closing Date');
  assert.equal(deadline.seeTextContent, SKX_DEADLINE);
  assert.match(oversub.value, /prorated back to the cap pro rata/);
  assert.equal(oversub.seeTextContent, SKX_OVERSUB);
  const fallback = rows.find((r) => r.id === 'election-default');
  assert.equal(fallback.value, 'Treated as Cash Election');
  // rows resolve to the owning card for the sidebar click-through
  assert.equal(deadline.card.id, 'skx-card');
});

test('rows (QXO): caps row present with by-cap pills data and the allocation clause behind See provision', () => {
  const rows = rowsMod.buildElectionMechanicsRows({
    options: [{ label: 'Cash Election', economics: '$505.00 / share' }, { label: 'Stock Election', economics: '20.200 Parent shares' }],
    defaultTreatment: 'Stock Election',
    isProrated: true,
    prorationNote: QXO_ALLOCATION,
    caps: [
      { label: 'Maximum Cash Election Number', figure: '45%' },
      { label: 'Maximum Stock Election Number', figure: '55%' },
    ],
    electionDeadline: QXO_DEADLINE,
    oversubscriptionTreatment: QXO_OVERSUB,
    evidence: '…',
    sourceCard: { id: 'qxo-card' },
  });
  const caps = rows.find((r) => r.id === 'election-caps');
  assert.ok(caps);
  assert.equal(caps.caps.length, 2);
  assert.equal(caps.seeTextContent, QXO_ALLOCATION);
  const oversub = rows.find((r) => r.id === 'election-oversubscription');
  assert.match(oversub.value, /If either side is oversubscribed/);
  assert.equal(oversub.seeTextContent, QXO_OVERSUB);
});

test('rows: defined-term-echo deadline is dropped entirely; unrecognized oversubscription shape keeps the row with NO derived sentence but the clause behind See provision', () => {
  const weird = 'Any shortfall in either form of consideration shall be reallocated among the holders as the Exchange Agent determines equitable.';
  const rows = rowsMod.buildElectionMechanicsRows({
    ...skechersElection(),
    electionDeadline: 'Election Deadline',
    oversubscriptionTreatment: weird,
  });
  assert.equal(rows.find((r) => r.id === 'election-deadline'), undefined, 'garbage deadline row must not render');
  const oversub = rows.find((r) => r.id === 'election-oversubscription');
  assert.ok(oversub, 'row survives (the fact of proration is real)');
  assert.equal(oversub.value, null, 'no derived sentence for an unrecognized shape');
  assert.equal(oversub.seeTextContent, weird, 'verbatim clause stays reachable via See provision');
});

test('rows: prorated deal with NO oversubscription clause at all -> proration row with clause only, no sentence', () => {
  const e = skechersElection();
  e.oversubscriptionTreatment = null;
  const rows = rowsMod.buildElectionMechanicsRows(e);
  const pror = rows.find((r) => r.id === 'election-proration');
  assert.ok(pror);
  assert.equal(pror.value, null);
  assert.equal(pror.seeTextContent, 'non-election default…');
});

test('rows: noElection decks build no mechanics rows (the fixed-split card renders instead)', () => {
  assert.deepEqual(rowsMod.buildElectionMechanicsRows({ noElection: true }), []);
  assert.deepEqual(rowsMod.buildElectionMechanicsRows(null), []);
});
